/**
 * Google OAuth via the Chrome Identity API.
 *
 * Reading notes uses only the read-only Docs scope. The optional "save to Google Docs" feature
 * additionally asks, when first used, for drive.file: it lets NotePilot create files and change
 * only the files it created itself, so it can never modify the user's notes (see
 * tests/readonly.test.ts, which enforces both statically).
 */
export const DOCS_READONLY_SCOPE = 'https://www.googleapis.com/auth/documents.readonly';
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const EXPORT_SCOPES = [DOCS_READONLY_SCOPE, DRIVE_FILE_SCOPE];

export interface AuthProvider {
  /** Defaults to the read-only Docs scope. */
  getToken(interactive: boolean, scopes?: string[]): Promise<string>;
  invalidate(token: string): Promise<void>;
  signOut(): Promise<void>;
}

export class AuthRequiredError extends Error {
  constructor(message = 'Google sign-in required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

const chromeAuth: AuthProvider = {
  async getToken(interactive, scopes = [DOCS_READONLY_SCOPE]) {
    try {
      const result = await chrome.identity.getAuthToken({ interactive, scopes });
      const token = typeof result === 'string' ? result : result?.token;
      if (!token) throw new AuthRequiredError();
      const granted = typeof result === 'object' ? result.grantedScopes : undefined;
      const missing = granted ? scopes.filter((sc) => !granted.includes(sc)) : [];
      if (missing.includes(DOCS_READONLY_SCOPE)) throw new AuthRequiredError('Read access to Google Docs was not granted');
      if (missing.length) throw new AuthRequiredError('Permission to create the Google Doc was not granted');
      return token;
    } catch (e) {
      if (e instanceof AuthRequiredError) throw e;
      throw new AuthRequiredError(e instanceof Error ? e.message : String(e));
    }
  },
  async invalidate(token) {
    await chrome.identity.removeCachedAuthToken({ token });
  },
  async signOut() {
    try {
      const token = await chromeAuth.getToken(false);
      // Revoke the grant so the next sign-in shows the consent screen again.
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
      await chrome.identity.removeCachedAuthToken({ token });
    } catch {
      /* not signed in */
    }
    await chrome.identity.clearAllCachedAuthTokens?.();
  },
};

/** Test-only provider, compiled in exclusively for the end-to-end build (VITE_E2E_FAKE_AUTH=1). */
const e2eAuth: AuthProvider = {
  async getToken() {
    return 'e2e-fake-token';
  },
  async invalidate() {},
  async signOut() {},
};

export const auth: AuthProvider = import.meta.env.VITE_E2E_FAKE_AUTH === '1' ? e2eAuth : chromeAuth;
