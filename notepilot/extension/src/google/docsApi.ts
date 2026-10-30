import type { DocsDocument } from '../core/docParser';
import { AuthRequiredError, type AuthProvider } from './auth';

/**
 * Read-only Google Docs API client.
 *
 * Change detection is two-tier:
 *   1. `documents.get?fields=revisionId` — tiny response; unchanged revisionId ⇒ unchanged doc.
 *   2. Full `documents.get` only when the revision changed (or the cheap check is unavailable).
 *
 * Only HTTP GET is used. There is intentionally no write method of any kind (enforced by tests/readonly.test.ts).
 */

export type DocsErrorKind = 'auth' | 'forbidden' | 'not_found' | 'rate_limit' | 'server' | 'network';

export class DocsApiError extends Error {
  constructor(
    readonly kind: DocsErrorKind,
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'DocsApiError';
  }
}

export interface DocsSource {
  getRevisionId(docId: string, signal?: AbortSignal): Promise<string | null>;
  getDocument(docId: string, signal?: AbortSignal): Promise<DocsDocument>;
}

const API = 'https://docs.googleapis.com/v1/documents/';

export interface DocsClientStats {
  requests: number;
  fullFetches: number;
  /** Timestamps of recent requests (for a requests-per-minute readout). */
  recent: number[];
}

export function createDocsClient(auth: AuthProvider, fetchImpl: typeof fetch = (...a) => fetch(...a)): DocsSource & { stats: DocsClientStats } {
  const stats: DocsClientStats = { requests: 0, fullFetches: 0, recent: [] };

  async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
    let token: string;
    try {
      token = await auth.getToken(false);
    } catch (e) {
      throw new DocsApiError('auth', e instanceof Error ? e.message : 'Sign-in required', 401);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      stats.requests++;
      const now = Date.now();
      stats.recent.push(now);
      while (stats.recent.length && stats.recent[0] < now - 60_000) stats.recent.shift();
      let res: Response;
      try {
        res = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
      } catch (e) {
        if (signal?.aborted) throw e;
        throw new DocsApiError('network', 'Network unavailable');
      }
      if (res.ok) return (await res.json()) as T;
      if (res.status === 401 && attempt === 0) {
        // Expired token: drop it from Chrome's cache and retry once with a fresh one.
        await auth.invalidate(token);
        try {
          token = await auth.getToken(false);
        } catch (e) {
          throw new DocsApiError('auth', e instanceof AuthRequiredError ? e.message : 'Sign-in required', 401);
        }
        continue;
      }
      let detail = '';
      try {
        detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? '';
      } catch {
        /* ignore */
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;
      if (res.status === 401) throw new DocsApiError('auth', 'Google sign-in expired', 401);
      if (res.status === 403) {
        if (/rate|quota/i.test(detail)) throw new DocsApiError('rate_limit', detail || 'Quota exceeded', 403, retryAfterMs);
        throw new DocsApiError('forbidden', detail || 'No permission to read this document', 403);
      }
      if (res.status === 404) throw new DocsApiError('not_found', 'Document not found or not shared with you', 404);
      if (res.status === 429) throw new DocsApiError('rate_limit', detail || 'Too many requests', 429, retryAfterMs);
      throw new DocsApiError('server', detail || `Google Docs API error ${res.status}`, res.status, retryAfterMs);
    }
    throw new DocsApiError('auth', 'Sign-in required', 401);
  }

  return {
    stats,
    async getRevisionId(docId, signal) {
      const r = await get<{ revisionId?: string }>(`${API}${encodeURIComponent(docId)}?fields=revisionId`, signal);
      return r.revisionId ?? null;
    },
    async getDocument(docId, signal) {
      stats.fullFetches++;
      return get<DocsDocument>(
        `${API}${encodeURIComponent(docId)}?includeTabsContent=true&suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`,
        signal,
      );
    },
  };
}
