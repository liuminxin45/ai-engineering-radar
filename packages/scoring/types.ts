export interface ScoringItem {
  id: string;
  title: string;
}

export interface ScoringRubric {
  version: string;
  instructions: string;
  levels: readonly string[];
}

export interface ProviderScore {
  id: string;
  score: number;
  model: string;
}

/** Adapters return valid results only; omitted IDs can fall through to another provider. */
export interface ScoringProvider {
  id: string;
  displayName: string;
  priority: number;
  maxBatchSize: number;
  scoreBatch(
    items: readonly ScoringItem[],
    rubric: ScoringRubric,
    signal: AbortSignal,
  ): Promise<ProviderScore[]>;
}

export type ProviderFailureKind =
  | "missing-key"
  | "authentication"
  | "quota"
  | "rate-limit"
  | "temporary"
  | "invalid-request"
  | "too-large"
  | "invalid-response";

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    public readonly retryAfterMs?: number,
  ) {
    // Never forward remote response bodies, URLs, or credentials to logs.
    super(kind);
    this.name = "ProviderError";
  }
}

export interface ScoringEvent {
  provider: string;
  kind: ProviderFailureKind;
  count: number;
}
