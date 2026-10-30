/** User-configurable settings (persisted in chrome.storage.local; the API key never syncs). */

export type RewriteIntensity = 'light' | 'balanced' | 'thorough';
export type DetailLevel = 'concise' | 'standard' | 'detailed';
/** How far the AI may go in finishing what the notes leave unfinished. */
export type Completion = 'off' | 'finish' | 'develop';
export type InsightDepth = 'off' | 'brief' | 'standard' | 'deep';
export type Frequency = 'realtime' | 'balanced' | 'saver';
export type JsonMode = 'json_schema' | 'json_object' | 'prompt_only';

export interface AISettings {
  /** "direct": the extension calls an OpenAI-compatible endpoint with the user's own key.
   *  "proxy":  the extension calls the NotePilot server, which holds the provider key. */
  mode: 'direct' | 'proxy';
  baseUrl: string;
  apiKey: string;
  proxyUrl: string;
  proxyToken: string;
  fastModel: string;
  deepModel: string;
  jsonMode: JsonMode;
  /** USD per 1M tokens, used for cost estimates and limits. Edit to match your provider. */
  inputPricePerM: number;
  outputPricePerM: number;
}

export interface PrivacySettings {
  redactPII: boolean;
  storeLocally: boolean;
  perDocApproval: boolean;
  approvedDocs: string[];
  excludedDocs: string[];
}

export interface DisplaySettings {
  showOriginLabels: boolean;
  showExpansions: boolean;
  highlightUpdates: boolean;
}

export interface Consent {
  /** Origin (scheme+host) that the user agreed may receive note content. */
  endpointOrigin: string;
  at: number;
}

export interface Settings {
  autoProcess: boolean;
  ai: AISettings;
  rewriteIntensity: RewriteIntensity;
  detailLevel: DetailLevel;
  /** off: keep fragments as written · finish: complete cut-off sentences · develop: also write out half-developed ideas. */
  completion: Completion;
  insightDepth: InsightDepth;
  subject: string;
  aiExpansion: boolean;
  frequency: Frequency;
  dailyBudgetUSD: number;
  privacy: PrivacySettings;
  display: DisplaySettings;
  consent: Consent | null;
}

export const DEFAULT_SETTINGS: Settings = {
  autoProcess: true,
  ai: {
    mode: 'direct',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    proxyUrl: 'http://localhost:8787/v1',
    proxyToken: '',
    fastModel: 'gpt-5.4-mini',
    deepModel: 'gpt-5.4',
    jsonMode: 'json_object',
    inputPricePerM: 0.75,
    outputPricePerM: 4.5,
  },
  rewriteIntensity: 'balanced',
  detailLevel: 'standard',
  completion: 'develop',
  insightDepth: 'standard',
  subject: '',
  aiExpansion: true,
  frequency: 'balanced',
  dailyBudgetUSD: 1,
  privacy: { redactPII: true, storeLocally: true, perDocApproval: false, approvedDocs: [], excludedDocs: [] },
  display: { showOriginLabels: true, showExpansions: true, highlightUpdates: true },
  consent: null,
};

export const PROVIDER_PRESETS: { label: string; baseUrl: string; fast: string; deep: string; jsonMode: JsonMode }[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', fast: 'gpt-5.4-mini', deep: 'gpt-5.4', jsonMode: 'json_object' },
  { label: 'Anthropic (OpenAI-compatible)', baseUrl: 'https://api.anthropic.com/v1', fast: 'claude-haiku-5-5', deep: 'claude-opus-5-5', jsonMode: 'prompt_only' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', fast: 'openai/gpt-5.4-mini', deep: 'openai/gpt-5.4', jsonMode: 'json_object' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', fast: 'llama3.1', deep: 'llama3.1', jsonMode: 'json_object' },
];

/** Polling cadences (ms) per frequency setting: [active, recentlyActive, idle, background]. */
export const POLL_INTERVALS: Record<Frequency, [number, number, number, number]> = {
  realtime: [2000, 3000, 8000, 30000],
  balanced: [3000, 5000, 15000, 60000],
  saver: [6000, 12000, 45000, 120000],
};

export function endpointOrigin(s: AISettings): string {
  try {
    return new URL(s.mode === 'proxy' ? s.proxyUrl : s.baseUrl).origin;
  } catch {
    return '';
  }
}

export function isAIConfigured(s: AISettings): boolean {
  if (!endpointOrigin(s) || !s.fastModel.trim()) return false;
  if (s.mode === 'proxy') return !!s.proxyToken.trim();
  // Local servers (e.g. Ollama) usually need no key.
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(endpointOrigin(s));
  return local || !!s.apiKey.trim();
}

export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const s = stored ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    ai: { ...DEFAULT_SETTINGS.ai, ...(s.ai ?? {}) },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...(s.privacy ?? {}) },
    display: { ...DEFAULT_SETTINGS.display, ...(s.display ?? {}) },
  };
}
