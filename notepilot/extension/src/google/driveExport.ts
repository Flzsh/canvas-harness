import { AuthRequiredError, EXPORT_SCOPES, type AuthProvider } from './auth';

/**
 * Saves NotePilot's organized notes as a separate Google Doc ("companion doc").
 *
 * Safety:
 *  - Uses the drive.file scope only: Google lets NotePilot change files it created itself and
 *    nothing else, so the user's notes cannot be modified even by mistake.
 *  - Only the Drive *upload* endpoint is used: POST creates a new Google Doc from HTML, PATCH
 *    replaces the content of the companion doc created earlier.
 *  - It refuses to target the document the notes are read from.
 */

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_DOC = 'application/vnd.google-apps.document';

export type ExportErrorKind = 'auth' | 'api_disabled' | 'forbidden' | 'rate_limit' | 'network' | 'server' | 'refused';

export class ExportError extends Error {
  constructor(
    readonly kind: ExportErrorKind,
    message: string,
    /** Google's error reason, e.g. "appNotAuthorizedToFile". */
    readonly reason = '',
  ) {
    super(message);
    this.name = 'ExportError';
  }
}

export interface SavedDoc {
  fileId: string;
  url: string;
  created: boolean;
}

export interface SaveOptions {
  /** Complete HTML document; Google converts it to a Google Doc (headings, lists, tables, colours). */
  html: string;
  name: string;
  /** The Google Doc the notes are read from. Never written. */
  sourceDocId: string;
  /** Companion doc created by an earlier export, updated in place when it still exists. */
  existingFileId?: string;
  auth: AuthProvider;
  /** Call auth with interactive consent (needs a recent click). */
  interactive?: boolean;
  fetchImpl?: typeof fetch;
}

export async function saveAsGoogleDoc(opts: SaveOptions): Promise<SavedDoc> {
  const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const existing = opts.existingFileId && opts.existingFileId !== opts.sourceDocId ? opts.existingFileId : undefined;

  let token = await getToken(opts.auth, !!opts.interactive);

  const send = async (method: 'POST' | 'PATCH', url: string, metadata: Record<string, unknown>) => {
    const boundary = `np${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${opts.html}\r\n--${boundary}--`;
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetchImpl(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
      } catch {
        throw new ExportError('network', 'Could not reach Google Drive. Check your connection and try again.');
      }
      if (res.status === 401 && attempt === 0) {
        await opts.auth.invalidate(token);
        token = await getToken(opts.auth, false);
        continue;
      }
      return res;
    }
    throw new ExportError('auth', 'Google sign-in expired. Try again.');
  };

  if (existing) {
    const res = await send('PATCH', `${UPLOAD}/${encodeURIComponent(existing)}?uploadType=multipart&fields=id,webViewLink,trashed`, { name: opts.name });
    if (res.ok) {
      const f = (await res.json()) as { id: string; webViewLink?: string; trashed?: boolean };
      if (!f.trashed && f.id === existing) return { fileId: f.id, url: f.webViewLink ?? docUrl(f.id), created: false };
      // The companion doc is in the trash: leave it there and create a fresh one.
    } else if (res.status !== 404) {
      const err = await toError(res);
      // Make a new doc only when the old one is gone (404, trash) or NotePilot may no longer change
      // it. Anything else is reported: a new doc per click would leave a trail of copies in Drive.
      if (!(res.status === 403 && NOT_OURS.has(err.reason))) throw err;
    }
  }

  const res = await send('POST', `${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    name: opts.name,
    mimeType: GOOGLE_DOC,
    description: 'Created by NotePilot AI. Updated each time you click Summarize; edits made here are overwritten.',
  });
  if (!res.ok) throw await toError(res);
  const f = (await res.json()) as { id: string; webViewLink?: string };
  if (!f.id || f.id === opts.sourceDocId) throw new ExportError('refused', 'Unexpected response from Google Drive.');
  return { fileId: f.id, url: f.webViewLink ?? docUrl(f.id), created: true };
}

/** 403 reasons meaning the companion doc exists but NotePilot can no longer change it. */
const NOT_OURS = new Set(['appNotAuthorizedToFile', 'insufficientFilePermissions']);

export const docUrl = (id: string) => `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit`;

async function getToken(auth: AuthProvider, interactive: boolean): Promise<string> {
  try {
    return await auth.getToken(interactive, EXPORT_SCOPES);
  } catch (e) {
    const msg = e instanceof AuthRequiredError ? e.message : 'Google permission was not granted';
    throw new ExportError('auth', `${msg}. NotePilot needs permission to create a Google Doc (it can only change files it creates).`);
  }
}

async function toError(res: Response): Promise<ExportError> {
  let message = '';
  let reason = '';
  try {
    const j = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } };
    message = j.error?.message ?? '';
    reason = j.error?.errors?.[0]?.reason ?? j.error?.details?.find((d) => d.reason)?.reason ?? '';
  } catch {
    /* ignore */
  }
  if (res.status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(reason + message)) {
    return new ExportError('api_disabled', 'The Google Drive API is not enabled for your Google Cloud project. Enable it (APIs & Services → Library → Google Drive API), then try again.');
  }
  if (res.status === 403 && /insufficient/i.test(reason + message)) {
    return new ExportError('auth', 'NotePilot does not have permission to create Google Docs yet. Try again and approve the permission.');
  }
  if (res.status === 429 || (res.status === 403 && /rateLimit|userRateLimit/i.test(reason))) {
    return new ExportError('rate_limit', 'Google Drive is busy. Wait a minute and try again.');
  }
  if (res.status === 403 || res.status === 404) return new ExportError('forbidden', message || 'Google Drive refused the request.', reason);
  return new ExportError('server', `Google Drive error ${res.status}${message ? `: ${message}` : ''}`, reason);
}
