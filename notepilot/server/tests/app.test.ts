import { describe, expect, it, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const TOKEN = 'student-token-0123456789';
let server: Server | null = null;
afterEach(() => server?.close());

async function start(env: Record<string, string> = {}, upstream?: (body: Record<string, unknown>, signal?: AbortSignal | null) => Promise<Response>) {
  const calls: { url: string; auth: string; body: Record<string, unknown> }[] = [];
  let now = Date.parse('2026-10-19T12:00:00Z');
  const config = loadConfig({ UPSTREAM_API_KEY: 'sk-upstream', ACCESS_TOKENS: `alice:${TOKEN}`, RATE_LIMIT_PER_MIN: '3', DAILY_TOKEN_LIMIT: '5000', ...env });
  const { handler } = createApp(config, {
    now: () => now,
    fetch: (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ url, auth: (init.headers as Record<string, string>).Authorization, body });
      if (upstream) return upstream(body, init.signal);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ops":[]}' } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }), { status: 200 });
    }) as typeof fetch,
  });
  server = createServer(handler);
  await new Promise<void>((r) => server!.listen(0, r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  const post = (body: unknown, token = TOKEN) =>
    fetch(`${base}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { base, post, calls, tick: (ms: number) => (now += ms) };
}

const req = (content = 'hi') => ({ model: 'gpt-4.1-mini', messages: [{ role: 'user', content }] });

describe('NotePilot proxy', () => {
  it('rejects missing or wrong tokens', async () => {
    const s = await start();
    expect((await s.post(req(), 'nope-nope-nope-nope-nope')).status).toBe(401);
    expect((await fetch(`${s.base}/health`)).status).toBe(200);
  });

  it('forwards to the upstream with the server-held key and records usage', async () => {
    const s = await start();
    const r = await s.post({ ...req(), stream: true });
    expect(r.status).toBe(200);
    expect(s.calls[0]).toMatchObject({ url: 'https://api.openai.com/v1/chat/completions', auth: 'Bearer sk-upstream' });
    expect(s.calls[0].body.stream).toBe(false);
    const usage = await (await fetch(`${s.base}/v1/usage`, { headers: { Authorization: `Bearer ${TOKEN}` } })).json();
    expect(usage).toMatchObject({ user: 'alice', requests: 1, promptTokens: 1000, completionTokens: 200 });
  });

  it('serves identical requests from cache', async () => {
    const s = await start();
    await s.post(req('same'));
    const r = await s.post(req('same'));
    expect(r.headers.get('x-notepilot-cache')).toBe('hit');
    expect(s.calls).toHaveLength(1);
  });

  it('enforces the per-user rate limit and the daily token budget', async () => {
    const s = await start();
    for (let i = 0; i < 3; i++) expect((await s.post(req(`m${i}`))).status).toBe(200);
    const limited = await s.post(req('m3'));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    s.tick(60_000);
    // 1200 tokens per request: 3600 → 4800 → 6000 ≥ 5000, so the 6th request is refused.
    expect((await s.post(req('m4'))).status).toBe(200);
    expect((await s.post(req('m5'))).status).toBe(200);
    expect((await s.post(req('m6'))).status).toBe(402);
    s.tick(24 * 3600_000);
    expect((await s.post(req('m7'))).status).toBe(200);
  });

  it('enforces the model allowlist and body validation', async () => {
    const s = await start({ ALLOWED_MODELS: 'gpt-4.1-mini' });
    expect((await s.post({ ...req(), model: 'expensive-model' })).status).toBe(400);
    expect((await s.post({ foo: 1 })).status).toBe(400);
  });

  it('passes upstream errors through and does not cache them', async () => {
    const s = await start({}, async () => new Response(JSON.stringify({ error: { message: 'overloaded' } }), { status: 503, headers: { 'retry-after': '7' } }));
    const r = await s.post(req());
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('7');
    await s.post(req());
    expect(s.calls).toHaveLength(2);
  });

  it('validates configuration', () => {
    expect(() => loadConfig({ ACCESS_TOKENS: `a:${TOKEN}` })).toThrow(/UPSTREAM_API_KEY/);
    expect(() => loadConfig({ UPSTREAM_API_KEY: 'k', ACCESS_TOKENS: 'a:short' })).toThrow(/too short/);
  });
});
