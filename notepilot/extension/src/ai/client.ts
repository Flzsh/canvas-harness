import type { AISettings, JsonMode } from '../core/settings';
import type { ChatMessage } from '../core/context';

/**
 * Minimal client for OpenAI-compatible `POST /chat/completions` endpoints (OpenAI, Anthropic's
 * OpenAI-compatible API, OpenRouter, Ollama, LM Studio, the NotePilot proxy, …).
 * Non-streaming: patches are only useful once complete and validated.
 */

export type AIErrorKind = 'auth' | 'rate_limit' | 'server' | 'network' | 'bad_request' | 'aborted' | 'invalid_output';

export class AIError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens: number;
  jsonMode: JsonMode;
  jsonSchema?: { name: string; schema: object };
  signal?: AbortSignal;
}

export interface AIResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

/** Per-endpoint/model parameter quirks discovered at runtime (e.g. reasoning models). */
type Quirks = { maxCompletionTokens?: boolean; noTemperature?: boolean; noResponseFormat?: boolean; noSchema?: boolean };
const quirks = new Map<string, Quirks>();

/** Known quirks, so current reasoning models work on the first request instead of after 400s. */
export function knownQuirks(url: string, model: string): Quirks {
  const m = model.toLowerCase().replace(/^[\w-]+\//, '');
  const q: Quirks = {};
  if (/api\.openai\.com/.test(url) || /^(gpt-5|o\d)/.test(m)) q.maxCompletionTokens = true;
  if (/^(gpt-5|o\d)/.test(m) || /^claude-(opus|sonnet|haiku|fable)-5/.test(m)) q.noTemperature = true;
  return q;
}

export function endpointFor(s: AISettings): { url: string; key: string } {
  const base = (s.mode === 'proxy' ? s.proxyUrl : s.baseUrl).replace(/\/+$/, '');
  return { url: `${base}/chat/completions`, key: s.mode === 'proxy' ? s.proxyToken : s.apiKey };
}

export async function chatCompletion(settings: AISettings, req: AIRequest, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<AIResult> {
  const { url, key } = endpointFor(settings);
  const qk = `${url}|${req.model}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const q = quirks.get(qk) ?? knownQuirks(url, req.model);
    const body: Record<string, unknown> = { model: req.model, messages: req.messages, stream: false };
    if (q.maxCompletionTokens) body.max_completion_tokens = req.maxTokens;
    else body.max_tokens = req.maxTokens;
    if (req.temperature !== undefined && !q.noTemperature) body.temperature = req.temperature;
    if (!q.noResponseFormat) {
      if (req.jsonMode === 'json_schema' && req.jsonSchema && !q.noSchema) {
        body.response_format = { type: 'json_schema', json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: true } };
      } else if (req.jsonMode === 'json_object' || (req.jsonMode === 'json_schema' && q.noSchema)) {
        body.response_format = { type: 'json_object' };
      }
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (/api\.anthropic\.com/.test(url) && key) headers['x-api-key'] = key;

    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal });
    } catch (e) {
      if (req.signal?.aborted) throw new AIError('aborted', 'Request cancelled');
      throw new AIError('network', e instanceof Error ? e.message : 'Network error');
    }
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };
      const choice = json.choices?.[0];
      const text = choice?.message?.content ?? '';
      if (!text) throw new AIError('invalid_output', choice?.message?.refusal || 'Empty model response');
      if (choice?.finish_reason === 'length') throw new AIError('invalid_output', 'Model response was cut off (max tokens reached)');
      return {
        text,
        promptTokens: json.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(req.messages).length / 4),
        completionTokens: json.usage?.completion_tokens ?? Math.ceil(text.length / 4),
        latencyMs: Math.round(performance.now() - t0),
        model: json.model ?? req.model,
      };
    }
    let message = '';
    try {
      const err = (await res.json()) as { error?: { message?: string } | string };
      message = typeof err.error === 'string' ? err.error : err.error?.message ?? '';
    } catch {
      /* ignore */
    }
    if (res.status === 400) {
      // Adapt to provider-specific parameter support, then retry.
      const m = message.toLowerCase();
      const next = { ...q };
      if (m.includes('max_tokens') && m.includes('max_completion_tokens')) next.maxCompletionTokens = true;
      else if (m.includes('temperature')) next.noTemperature = true;
      else if (m.includes('json_schema')) next.noSchema = true;
      else if (m.includes('response_format')) next.noResponseFormat = true;
      if (JSON.stringify(next) !== JSON.stringify(q)) {
        quirks.set(qk, next);
        continue;
      }
      throw new AIError('bad_request', message || 'The AI provider rejected the request', 400);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;
    if (res.status === 401 || res.status === 403) throw new AIError('auth', message || 'The AI provider rejected the API key', res.status);
    if (res.status === 429) throw new AIError('rate_limit', message || 'AI rate limit reached', 429, retryAfterMs);
    if (res.status === 402) throw new AIError('rate_limit', message || 'AI budget exhausted', 402, 60 * 60_000);
    throw new AIError('server', message || `AI provider error ${res.status}`, res.status, retryAfterMs);
  }
  throw new AIError('bad_request', 'Could not find request parameters accepted by this provider');
}
