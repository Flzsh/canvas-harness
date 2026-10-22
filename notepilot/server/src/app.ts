import { createHash, timingSafeEqual } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { ServerConfig } from './config.js';

/**
 * NotePilot model proxy.
 *
 * Keeps the provider API key on the server, authenticates users with per-user tokens, enforces
 * rate limits and daily token budgets, caches identical requests, and records usage counts.
 * It never logs or stores prompt/response content.
 */

interface Usage {
  day: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cacheHits: number;
}

export interface AppDeps {
  fetch: typeof fetch;
  now: () => number;
}

class LruCache {
  private map = new Map<string, { at: number; status: number; body: string }>();
  constructor(
    private max: number,
    private ttl: number,
    private now: () => number,
  ) {}
  get(k: string) {
    const v = this.map.get(k);
    if (!v) return undefined;
    if (this.now() - v.at > this.ttl) {
      this.map.delete(k);
      return undefined;
    }
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }
  set(k: string, status: number, body: string) {
    this.map.set(k, { at: this.now(), status, body });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}

class TokenBucket {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private perMin: number,
    private now: () => number,
  ) {}
  take(user: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    const b = this.buckets.get(user) ?? { tokens: this.perMin, at: t };
    b.tokens = Math.min(this.perMin, b.tokens + ((t - b.at) / 60_000) * this.perMin);
    b.at = t;
    this.buckets.set(user, b);
    if (b.tokens < 1) return { ok: false, retryAfterSec: Math.ceil(((1 - b.tokens) / this.perMin) * 60) };
    b.tokens -= 1;
    return { ok: true, retryAfterSec: 0 };
  }
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function createApp(config: ServerConfig, deps: AppDeps = { fetch: globalThis.fetch, now: Date.now }) {
  const usage = new Map<string, Usage>();
  const cache = new LruCache(500, config.cacheTtlMs, deps.now);
  const limiter = new TokenBucket(config.rateLimitPerMin, deps.now);

  const usageFor = (user: string): Usage => {
    const day = dayOf(deps.now());
    let u = usage.get(user);
    if (!u || u.day !== day) {
      u = { day, requests: 0, promptTokens: 0, completionTokens: 0, cacheHits: 0 };
      usage.set(user, u);
    }
    return u;
  };

  const authenticate = (req: IncomingMessage): string | null => {
    const h = req.headers.authorization ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return null;
    const given = Buffer.from(m[1].trim());
    for (const [token, user] of config.tokens) {
      const expected = Buffer.from(token);
      if (expected.length === given.length && timingSafeEqual(expected, given)) return user;
    }
    return null;
  };

  const send = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(text);
  };
  const error = (res: ServerResponse, status: number, message: string, headers?: Record<string, string>) => send(res, status, { error: { message } }, headers);

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > config.maxBodyBytes) {
          reject(new Error('too_large'));
          req.destroy();
          return;
        }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const logUsage = (entry: Record<string, unknown>) => {
    if (!config.usageLog) return;
    void appendFile(config.usageLog, JSON.stringify({ at: new Date(deps.now()).toISOString(), ...entry }) + '\n').catch(() => undefined);
  };

  const handler: RequestListener = async (req, res) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

      const user = authenticate(req);
      if (!user) return error(res, 401, 'Invalid or missing access token');

      if (req.method === 'GET' && url.pathname === '/v1/usage') {
        const u = usageFor(user);
        return send(res, 200, { user, ...u, dailyTokenLimit: config.dailyTokenLimit });
      }

      if (req.method !== 'POST' || url.pathname !== '/v1/chat/completions') return error(res, 404, 'Not found');

      let raw: string;
      try {
        raw = await readBody(req);
      } catch {
        return error(res, 413, 'Request too large');
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw);
      } catch {
        return error(res, 400, 'Body must be JSON');
      }
      if (typeof body.model !== 'string' || !Array.isArray(body.messages)) return error(res, 400, 'model and messages are required');
      if (config.allowedModels.size && !config.allowedModels.has(body.model)) return error(res, 400, `Model "${body.model}" is not allowed on this server`);
      body.stream = false;

      const u = usageFor(user);
      if (u.promptTokens + u.completionTokens >= config.dailyTokenLimit) return error(res, 402, 'Daily token budget exhausted for this user', { 'Retry-After': '3600' });

      const key = createHash('sha256').update(user).update('\0').update(JSON.stringify(body)).digest('hex');
      const hit = cache.get(key);
      if (hit) {
        u.cacheHits++;
        return send(res, hit.status, hit.body, { 'X-NotePilot-Cache': 'hit' });
      }

      const rl = limiter.take(user);
      if (!rl.ok) return error(res, 429, 'Rate limit exceeded', { 'Retry-After': String(rl.retryAfterSec) });

      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), config.upstreamTimeoutMs);
      // If the extension cancels (stale request), cancel upstream too and stop paying for it.
      res.on('close', () => {
        if (!res.writableEnded) ctl.abort();
      });
      const t0 = deps.now();
      let upstream: Response;
      try {
        upstream = await deps.fetch(`${config.upstreamBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.upstreamApiKey}` },
          body: JSON.stringify(body),
          signal: ctl.signal,
        });
      } catch {
        clearTimeout(timeout);
        if (ctl.signal.aborted && res.destroyed) return;
        return error(res, 502, 'Upstream AI provider unreachable');
      }
      const text = await upstream.text().catch(() => '');
      clearTimeout(timeout);
      u.requests++;
      let prompt = 0;
      let completion = 0;
      if (upstream.ok) {
        try {
          const j = JSON.parse(text) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
          prompt = j.usage?.prompt_tokens ?? 0;
          completion = j.usage?.completion_tokens ?? 0;
        } catch {
          /* non-JSON upstream body */
        }
        u.promptTokens += prompt;
        u.completionTokens += completion;
        cache.set(key, upstream.status, text);
      }
      logUsage({ user, model: body.model, status: upstream.status, prompt, completion, ms: deps.now() - t0 });
      const passHeaders: Record<string, string> = {};
      const ra = upstream.headers.get('retry-after');
      if (ra) passHeaders['Retry-After'] = ra;
      return send(res, upstream.status, text || JSON.stringify({ error: { message: `Upstream error ${upstream.status}` } }), passHeaders);
    } catch (e) {
      if (!res.headersSent) error(res, 500, 'Internal error');
      console.error('[notepilot-server]', e instanceof Error ? e.message : e);
    }
  };

  return { handler, usage };
}
