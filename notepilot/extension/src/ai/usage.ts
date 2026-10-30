import type { AISettings } from '../core/settings';

/** Daily token / cost accounting used to enforce the user's cost limit. */
export interface DailyUsage {
  day: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  costUSD: number;
  cacheHits: number;
}

export interface UsagePersistence {
  load(): Promise<DailyUsage | null>;
  save(u: DailyUsage): Promise<void>;
}

const today = (now = Date.now()) => new Date(now).toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

export class UsageTracker {
  private usage: DailyUsage = { day: today(), requests: 0, promptTokens: 0, completionTokens: 0, costUSD: 0, cacheHits: 0 };
  private listeners = new Set<(u: DailyUsage) => void>();

  constructor(private persistence?: UsagePersistence) {}

  async init(): Promise<void> {
    const stored = await this.persistence?.load();
    if (stored && stored.day === today()) this.usage = stored;
  }

  private roll(): void {
    if (this.usage.day !== today()) this.usage = { day: today(), requests: 0, promptTokens: 0, completionTokens: 0, costUSD: 0, cacheHits: 0 };
  }

  record(ai: AISettings, promptTokens: number, completionTokens: number): void {
    this.roll();
    this.usage.requests++;
    this.usage.promptTokens += promptTokens;
    this.usage.completionTokens += completionTokens;
    this.usage.costUSD += (promptTokens * ai.inputPricePerM + completionTokens * ai.outputPricePerM) / 1_000_000;
    void this.persistence?.save(this.usage);
    this.listeners.forEach((l) => l(this.get()));
  }

  recordCacheHit(): void {
    this.roll();
    this.usage.cacheHits++;
  }

  get(): DailyUsage {
    this.roll();
    return { ...this.usage };
  }

  overBudget(dailyBudgetUSD: number): boolean {
    return dailyBudgetUSD > 0 && this.get().costUSD >= dailyBudgetUSD;
  }

  subscribe(fn: (u: DailyUsage) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
