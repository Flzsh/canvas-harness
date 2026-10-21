export interface ServerConfig {
  port: number;
  upstreamBaseUrl: string;
  upstreamApiKey: string;
  /** token → user id */
  tokens: Map<string, string>;
  allowedModels: Set<string>;
  rateLimitPerMin: number;
  dailyTokenLimit: number;
  allowedOrigins: Set<string>;
  usageLog: string | null;
  cacheTtlMs: number;
  maxBodyBytes: number;
  upstreamTimeoutMs: number;
}

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const tokens = new Map<string, string>();
  for (const pair of list(env.ACCESS_TOKENS)) {
    const i = pair.indexOf(':');
    if (i <= 0) throw new Error(`ACCESS_TOKENS entry must be user:token, got "${pair}"`);
    const user = pair.slice(0, i);
    const token = pair.slice(i + 1);
    if (token.length < 16) throw new Error(`Token for "${user}" is too short (min 16 characters)`);
    tokens.set(token, user);
  }
  if (!env.UPSTREAM_API_KEY) throw new Error('UPSTREAM_API_KEY is required');
  if (tokens.size === 0) throw new Error('ACCESS_TOKENS must define at least one user:token pair');
  return {
    port: Number(env.PORT ?? 8787),
    upstreamBaseUrl: (env.UPSTREAM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    upstreamApiKey: env.UPSTREAM_API_KEY,
    tokens,
    allowedModels: new Set(list(env.ALLOWED_MODELS)),
    rateLimitPerMin: Number(env.RATE_LIMIT_PER_MIN ?? 30),
    dailyTokenLimit: Number(env.DAILY_TOKEN_LIMIT ?? 2_000_000),
    allowedOrigins: new Set(list(env.ALLOWED_ORIGINS)),
    usageLog: env.USAGE_LOG || null,
    cacheTtlMs: Number(env.CACHE_TTL_SEC ?? 600) * 1000,
    maxBodyBytes: 1_500_000,
    upstreamTimeoutMs: 120_000,
  };
}
