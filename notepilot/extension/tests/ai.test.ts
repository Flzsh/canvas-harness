import { describe, expect, it } from 'vitest';
import { chatCompletion, AIError, knownQuirks } from '../src/ai/client';
import { createPipelines, type ResponseCache } from '../src/ai/pipelines';
import { UsageTracker } from '../src/ai/usage';
import { DEFAULT_SETTINGS, type Settings, isAIConfigured } from '../src/core/settings';
import { createDocsClient, DocsApiError } from '../src/google/docsApi';

const ok = (content: string, usage = { prompt_tokens: 1000, completion_tokens: 500 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }], usage }), { status: 200 });

const settings: Settings = { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, apiKey: 'sk-test', baseUrl: 'https://api.example.com/v1/' } };

describe('chatCompletion', () => {
  it('sends an OpenAI-compatible request', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const r = await chatCompletion(settings.ai, { model: 'm', messages: [{ role: 'user', content: 'hi' }], maxTokens: 10, jsonMode: 'json_object' }, async (url, init) => {
      seen = { url: String(url), init: init! };
      return ok('{"ok":true}');
    });
    expect(seen!.url).toBe('https://api.example.com/v1/chat/completions');
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(seen!.init.body));
    expect(body).toMatchObject({ model: 'm', max_tokens: 10, response_format: { type: 'json_object' }, stream: false });
    expect(r).toMatchObject({ text: '{"ok":true}', promptTokens: 1000, completionTokens: 500 });
  });

  it('adapts to providers that require max_completion_tokens / reject temperature', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = async (_: unknown, init?: RequestInit) => {
      const b = JSON.parse(String(init!.body));
      bodies.push(b);
      if ('max_tokens' in b) return new Response(JSON.stringify({ error: { message: "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead." } }), { status: 400 });
      if ('temperature' in b) return new Response(JSON.stringify({ error: { message: 'temperature is not supported with this model' } }), { status: 400 });
      return ok('{}');
    };
    await chatCompletion(settings.ai, { model: 'reasoner', messages: [], maxTokens: 5, temperature: 0.2, jsonMode: 'prompt_only' }, fetchImpl as typeof fetch);
    expect(bodies).toHaveLength(3);
    expect(bodies[2]).toMatchObject({ max_completion_tokens: 5 });
    expect(bodies[2]).not.toHaveProperty('temperature');
  });

  it('sends known parameter shapes to current reasoning models on the first request', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = async (_: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init!.body)));
      return ok('{}');
    };
    for (const model of ['gpt-5.4-mini', 'openai/gpt-5.4', 'claude-haiku-5-5']) {
      await chatCompletion(settings.ai, { model, messages: [], maxTokens: 5, temperature: 0.2, jsonMode: 'prompt_only' }, fetchImpl as typeof fetch);
    }
    expect(bodies).toHaveLength(3);
    expect(bodies[0]).toMatchObject({ max_completion_tokens: 5 });
    expect(bodies[1]).toMatchObject({ max_completion_tokens: 5 });
    for (const b of bodies) expect(b).not.toHaveProperty('temperature');
    expect(knownQuirks('https://api.example.com/v1/chat/completions', 'llama3.1')).toEqual({});
  });

  it('maps HTTP errors to typed errors', async () => {
    const run = (status: number, headers: Record<string, string> = {}) =>
      chatCompletion(settings.ai, { model: 'm', messages: [], maxTokens: 5, jsonMode: 'prompt_only' }, async () => new Response('{}', { status, headers })).catch((e) => e as AIError) as Promise<AIError>;
    expect((await run(401)).kind).toBe('auth');
    const rl = await run(429, { 'retry-after': '12' });
    expect([rl.kind, rl.retryAfterMs]).toEqual(['rate_limit', 12_000]);
    expect((await run(503)).kind).toBe('server');
    const net = await chatCompletion(settings.ai, { model: 'm', messages: [], maxTokens: 5, jsonMode: 'prompt_only' }, async () => {
      throw new TypeError('Failed to fetch');
    }).catch((e) => e as AIError) as AIError;
    expect(net.kind).toBe('network');
  });

  it('treats truncated output as invalid', async () => {
    const e = await chatCompletion(settings.ai, { model: 'm', messages: [], maxTokens: 5, jsonMode: 'prompt_only' }, async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ops":[' }, finish_reason: 'length' }] }), { status: 200 }),
    ).catch((x) => x as AIError) as AIError;
    expect(e.kind).toBe('invalid_output');
  });
});

describe('pipelines', () => {
  it('retries once with validation feedback, tracks usage and caches results', async () => {
    const replies = ['this is not json', '```json\n{"title":null,"ops":[{"op":"delete_unit","id":"u_1"}]}\n```'];
    const sent: unknown[] = [];
    const usage = new UsageTracker();
    const store = new Map<string, string>();
    const cache: ResponseCache = { get: async (k) => store.get(k), set: async (k, v) => void store.set(k, v) };
    const p = createPipelines(() => settings, usage, cache, async (_s, req) => {
      sent.push(req.messages);
      return { text: replies.shift()!, promptTokens: 1_000_000, completionTokens: 0, latencyMs: 10, model: 'm' };
    });
    const r = await p.rewrite([{ role: 'user', content: 'x' }], new AbortController().signal);
    expect(r.ops).toEqual([{ op: 'delete_unit', id: 'u_1' }]);
    expect((sent[1] as { content: string }[]).at(-1)!.content).toMatch(/could not be used/);
    expect(usage.get().costUSD).toBeCloseTo(1.5); // 2 calls × 1M input tokens × $0.75
    expect(usage.overBudget(0.5)).toBe(true);
    const again = await p.rewrite([{ role: 'user', content: 'x' }], new AbortController().signal);
    expect(again.cached).toBe(true);
    expect(sent).toHaveLength(2);
  });
});

describe('settings', () => {
  it('requires a key for remote providers but not for local servers', () => {
    expect(isAIConfigured(DEFAULT_SETTINGS.ai)).toBe(false);
    expect(isAIConfigured({ ...DEFAULT_SETTINGS.ai, apiKey: 'k' })).toBe(true);
    expect(isAIConfigured({ ...DEFAULT_SETTINGS.ai, baseUrl: 'http://localhost:11434/v1' })).toBe(true);
    expect(isAIConfigured({ ...DEFAULT_SETTINGS.ai, mode: 'proxy', proxyToken: 't' })).toBe(true);
  });
});

describe('Docs API client', () => {
  const auth = (tokens: string[]) => ({
    invalidated: [] as string[],
    async getToken() {
      return tokens[0];
    },
    async invalidate(t: string) {
      this.invalidated.push(t);
      tokens.shift();
    },
    async signOut() {},
  });

  it('uses GET only, a cheap revision check, and refreshes expired tokens once', async () => {
    const a = auth(['old', 'new']);
    const calls: { url: string; method?: string; token: string }[] = [];
    const client = createDocsClient(a, (async (url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>).Authorization.slice(7);
      calls.push({ url, method: init.method, token });
      if (token === 'old') return new Response('{}', { status: 401 });
      return new Response(JSON.stringify({ revisionId: 'r9' }), { status: 200 });
    }) as typeof fetch);
    expect(await client.getRevisionId('DOC')).toBe('r9');
    expect(a.invalidated).toEqual(['old']);
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['GET', 'https://docs.googleapis.com/v1/documents/DOC?fields=revisionId'],
      ['GET', 'https://docs.googleapis.com/v1/documents/DOC?fields=revisionId'],
    ]);
    await client.getDocument('DOC');
    expect(calls.at(-1)!.url).toBe('https://docs.googleapis.com/v1/documents/DOC?includeTabsContent=true&suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS');
  });

  it('classifies errors', async () => {
    const client = (status: number, message = '') =>
      createDocsClient(auth(['t']), (async () => new Response(JSON.stringify({ error: { message } }), { status })) as unknown as typeof fetch);
    const kind = async (status: number, message?: string) => ((await client(status, message).getRevisionId('D').catch((e) => e)) as DocsApiError).kind;
    expect(await kind(403, 'The caller does not have permission')).toBe('forbidden');
    expect(await kind(403, 'Quota exceeded for quota metric Read requests')).toBe('rate_limit');
    expect(await kind(404)).toBe('not_found');
    expect(await kind(429)).toBe('rate_limit');
    expect(await kind(500)).toBe('server');
  });
});
