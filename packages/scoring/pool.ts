import {
  ProviderError,
  type ProviderScore,
  type ScoringEvent,
  type ScoringItem,
  type ScoringProvider,
  type ScoringRubric,
} from "./types.js";

export interface PoolScore extends ProviderScore {
  provider: string;
  displayName: string;
}

/** One instance per job: cooldowns and rotation never leak into the next run. */
export class ProviderPool {
  private disabled = new Set<string>();
  private cooldown = new Map<string, number>();
  private cursors = new Map<number, number>();
  private deadline: number;
  private now: () => number;
  private timeoutMs: number;
  readonly events: ScoringEvent[] = [];

  constructor(
    private providers: readonly ScoringProvider[],
    options: {
      requestTimeoutMs?: number;
      budgetMs?: number;
      now?: () => number;
    } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.timeoutMs = options.requestTimeoutMs ?? 20000;
    this.deadline = this.now() + (options.budgetMs ?? 120000);
  }

  get available() {
    return (
      this.now() < this.deadline &&
      this.providers.some((p) => this.isAvailable(p))
    );
  }

  private isAvailable(provider: ScoringProvider) {
    return (
      !this.disabled.has(provider.id) &&
      (this.cooldown.get(provider.id) ?? 0) <= this.now()
    );
  }

  private next(attempted: Set<string>) {
    const priorities = [...new Set(this.providers.map((p) => p.priority))].sort(
      (a, b) => a - b,
    );
    for (const priority of priorities) {
      const group = this.providers.filter((p) => p.priority === priority);
      const start = this.cursors.get(priority) ?? 0;
      for (let i = 0; i < group.length; i++) {
        const index = (start + i) % group.length,
          provider = group[index];
        if (attempted.has(provider.id) || !this.isAvailable(provider)) continue;
        this.cursors.set(priority, (index + 1) % group.length);
        return provider;
      }
    }
  }

  private recordFailure(
    provider: ScoringProvider,
    error: ProviderError,
    count: number,
  ) {
    this.events.push({ provider: provider.id, kind: error.kind, count });
    if (
      ["missing-key", "authentication", "quota", "invalid-request"].includes(
        error.kind,
      )
    )
      this.disabled.add(provider.id);
    else if (error.kind !== "too-large")
      this.cooldown.set(
        provider.id,
        this.now() + (error.retryAfterMs ?? 60000),
      );
  }

  private async request(
    provider: ScoringProvider,
    items: readonly ScoringItem[],
    rubric: ScoringRubric,
  ) {
    const remaining = this.deadline - this.now();
    if (remaining <= 0) throw new ProviderError("temporary");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Race as well as abort: a broken adapter must not exceed the job's budget.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => {
          controller.abort();
          reject(new ProviderError("temporary"));
        },
        Math.min(this.timeoutMs, remaining),
      );
    });
    try {
      return await Promise.race([
        provider.scoreBatch(items, rubric, controller.signal),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async runProvider(
    provider: ScoringProvider,
    items: readonly ScoringItem[],
    rubric: ScoringRubric,
  ) {
    const scores: ProviderScore[] = [];
    let failure: ProviderError | undefined;
    const visit = async (batch: readonly ScoringItem[]): Promise<void> => {
      if (failure) return;
      try {
        scores.push(...(await this.request(provider, batch, rubric)));
      } catch (error) {
        const safe =
          error instanceof ProviderError
            ? error
            : new ProviderError("temporary");
        if (
          safe.kind === "too-large" &&
          batch.length > 1 &&
          this.now() < this.deadline
        ) {
          const middle = Math.ceil(batch.length / 2);
          await visit(batch.slice(0, middle));
          await visit(batch.slice(middle));
        } else failure = safe;
      }
    };
    const limit = Math.max(1, Math.min(128, provider.maxBatchSize));
    for (let start = 0; start < items.length && !failure; start += limit)
      await visit(items.slice(start, start + limit));
    return { scores, failure };
  }

  async scoreBatch(
    items: readonly ScoringItem[],
    rubric: ScoringRubric,
  ): Promise<PoolScore[]> {
    const results = new Map<string, PoolScore>();
    const attempted = new Set<string>();
    while (results.size < items.length && this.now() < this.deadline) {
      const provider = this.next(attempted);
      if (!provider) break;
      attempted.add(provider.id);
      const remaining = items.filter((item) => !results.has(item.id));
      const wanted = new Set(remaining.map((item) => item.id));
      const { scores, failure } = await this.runProvider(
        provider,
        remaining,
        rubric,
      );
      for (const score of scores) {
        if (
          !wanted.has(score.id) ||
          !Number.isInteger(score.score) ||
          score.score < 0 ||
          score.score > 100 ||
          typeof score.model !== "string" ||
          !score.model.length ||
          score.model.length > 200
        )
          continue;
        // Duplicate results are ambiguous: keep the first valid answer, never shift positions.
        if (!results.has(score.id))
          results.set(score.id, {
            ...score,
            provider: provider.id,
            displayName: provider.displayName,
          });
      }
      if (failure) this.recordFailure(provider, failure, remaining.length);
      else if (remaining.some((item) => !results.has(item.id)))
        this.recordFailure(
          provider,
          new ProviderError("invalid-response"),
          remaining.filter((item) => !results.has(item.id)).length,
        );
    }
    return items.flatMap((item) =>
      results.has(item.id) ? [results.get(item.id)!] : [],
    );
  }
}
