import type { ChatMessage } from '../core/context';
import type { Settings } from '../core/settings';
import {
  extractJson,
  parseInsightsResponse,
  parseRewriteResponse,
  REWRITE_JSON_SCHEMA,
  stripNullOpFields,
  type InsightItem,
  type RewriteResponse,
} from '../core/schema';
import { hash53 } from '../core/text';
import { parseSummaryResponse, type DocSummary } from '../core/summary';
import type { OrganizedDoc } from '../core/types';
import { AIError, chatCompletion, type AIResult } from './client';
import type { UsageTracker } from './usage';

/**
 * The two AI pipelines:
 *  - rewrite  (fast model, high priority): produces validated patch ops for the organized notes.
 *  - insights (deeper model, low priority): produces validated insight updates.
 *
 * Both validate the model output against a schema and retry once with the validation error
 * when the output is malformed. Identical requests are served from a local cache.
 */

export interface ResponseCache {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export interface AIPipelines {
  rewrite(messages: ChatMessage[], signal: AbortSignal): Promise<RewriteResponse & { latencyMs: number; cached: boolean }>;
  insights(messages: ChatMessage[], signal: AbortSignal): Promise<{ upsert: InsightItem[]; remove: string[]; latencyMs: number; cached: boolean }>;
  /** On-demand summary (deeper model). Validated against the doc it summarizes. */
  summary(messages: ChatMessage[], doc: OrganizedDoc, signal: AbortSignal, opts?: { fresh?: boolean }): Promise<{ summary: DocSummary; latencyMs: number; cached: boolean }>;
}

export type ChatFn = typeof chatCompletion;

export function createPipelines(
  getSettings: () => Settings,
  usage: UsageTracker,
  cache?: ResponseCache,
  chat: ChatFn = chatCompletion,
): AIPipelines {
  async function call<T>(
    kind: 'rewrite' | 'insights' | 'summary',
    messages: ChatMessage[],
    signal: AbortSignal,
    parse: (json: unknown) => T,
    opts: { fresh?: boolean } = {},
  ): Promise<T & { latencyMs: number; cached: boolean }> {
    const s = getSettings();
    const model = kind === 'rewrite' ? s.ai.fastModel : s.ai.deepModel || s.ai.fastModel;
    const key = `${kind}:${hash53(`${s.ai.mode}|${s.ai.baseUrl}|${model}|${JSON.stringify(messages)}`)}`;
    const cachedText = opts.fresh ? undefined : await cache?.get(key).catch(() => undefined);
    if (cachedText) {
      try {
        usage.recordCacheHit();
        return { ...parse(extractJson(cachedText)), latencyMs: 0, cached: true };
      } catch {
        /* stale/invalid cache entry: fall through to a live call */
      }
    }

    let convo = messages;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      let result: AIResult;
      result = await chat(s.ai, {
        model,
        messages: convo,
        temperature: kind === 'insights' ? 0.4 : 0.2,
        maxTokens: kind === 'summary' ? 4000 : 8000,
        jsonMode: s.ai.jsonMode,
        jsonSchema: kind === 'rewrite' ? REWRITE_JSON_SCHEMA : undefined,
        signal,
      });
      usage.record(s.ai, result.promptTokens, result.completionTokens);
      try {
        const parsed = parse(extractJson(result.text));
        void cache?.set(key, result.text).catch(() => undefined);
        return { ...parsed, latencyMs: result.latencyMs, cached: false };
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        convo = [
          ...messages,
          { role: 'assistant', content: result.text.slice(0, 4000) },
          { role: 'user', content: `Your reply could not be used: ${msg.slice(0, 600)}. Reply again with ONLY the JSON object in the required format.` },
        ];
      }
    }
    throw new AIError('invalid_output', `Model output failed validation: ${lastError instanceof Error ? lastError.message.slice(0, 200) : ''}`);
  }

  return {
    rewrite: (messages, signal) =>
      call('rewrite', messages, signal, (json) => {
        const r = parseRewriteResponse(stripNullOpFields(json));
        // A patch where every op is malformed is treated as invalid output (retry with feedback).
        if (r.ops.length === 0 && r.invalidOps.length > 0) throw new Error(`all ops invalid, e.g. ${r.invalidOps[0].error}`);
        return r;
      }),
    insights: (messages, signal) => call('insights', messages, signal, (json) => parseInsightsResponse(json)),
    summary: (messages, doc, signal, opts) => call('summary', messages, signal, (json) => ({ summary: parseSummaryResponse(json, doc) }), opts),
  };
}
