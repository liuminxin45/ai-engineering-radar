// Reused from neo.github.io; the engine adapter reads Radar's public metadata.
export type SearchKind = "博文" | "论文";
export type SearchResult = {
  url: string;
  type: SearchKind;
  title: string;
  excerpt: string;
  date?: string;
  external?: boolean;
};
type SearchHit = {
  data: () => Promise<{
    url: string;
    excerpt: string;
    meta: Record<string, string>;
  }>;
};
export type SearchEngine = {
  init: () => Promise<void>;
  search: (term: string) => Promise<{ results: SearchHit[] }>;
};
type SearchSnapshot = {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: boolean;
  visibleCount: number;
  activeIndex: number;
};
const initial = (): SearchSnapshot => ({
  query: "",
  results: [],
  loading: true,
  error: false,
  visibleCount: 10,
  activeIndex: -1,
});

export class SearchSession {
  private snapshot = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private lifecycle = 0;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private engine: SearchEngine | undefined;
  private readonly loader: () => Promise<SearchEngine>;
  constructor(loader: () => Promise<SearchEngine>) {
    this.loader = loader;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<SearchSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async initialize(preserveQuery = false) {
    this.active = true;
    const lifecycle = ++this.lifecycle;
    this.update({
      ...initial(),
      query: preserveQuery ? this.snapshot.query : "",
    });
    try {
      const engine = await this.loader();
      if (!this.active || lifecycle !== this.lifecycle) return;
      this.engine = engine;
      this.update({ loading: false, error: false });
      if (this.snapshot.query.trim())
        this.schedule(this.snapshot.query, this.generation);
    } catch {
      if (this.active && lifecycle === this.lifecycle)
        this.update({ loading: false, error: true });
    }
  }
  setQuery(query: string) {
    const generation = ++this.generation;
    clearTimeout(this.timer);
    const unavailable = !this.engine && this.snapshot.error;
    this.update({
      query,
      results: [],
      visibleCount: 10,
      activeIndex: -1,
      loading: Boolean(query.trim()) && !unavailable,
      error: unavailable,
    });
    if (query.trim() && this.engine) this.schedule(query, generation);
    else if (!query.trim()) this.update({ loading: false });
  }
  private schedule(query: string, generation: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.search(query.trim(), generation);
    }, 300);
  }
  private async search(query: string, generation: number) {
    try {
      const response = await this.engine!.search(query);
      const results = await Promise.all(
        response.results.map(async (hit) => {
          const data = await hit.data();
          return {
            url: data.url,
            title: data.meta.title || "",
            excerpt: data.excerpt || "",
            type: data.meta.type as SearchKind,
            date: data.meta.date || undefined,
            external: data.meta.external === "true",
          };
        }),
      );
      if (!this.active || generation !== this.generation) return;
      this.update({ results, loading: false, error: false });
    } catch {
      if (this.active && generation === this.generation) {
        this.engine = undefined;
        this.update({ results: [], loading: false, error: true });
      }
    }
  }
  retry() {
    if (!this.engine) {
      void this.initialize(true);
      return;
    }
    this.setQuery(this.snapshot.query);
  }
  loadMore() {
    this.update({ visibleCount: this.snapshot.visibleCount + 10 });
  }
  selectNext(direction: number) {
    const count = Math.min(
      this.snapshot.results.length,
      this.snapshot.visibleCount,
    );
    if (count)
      this.update({
        activeIndex:
          this.snapshot.activeIndex < 0
            ? direction > 0
              ? 0
              : count - 1
            : (this.snapshot.activeIndex + direction + count) % count,
      });
  }
  dispose() {
    this.active = false;
    ++this.lifecycle;
    ++this.generation;
    clearTimeout(this.timer);
  }
}
