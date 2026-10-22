import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Static guarantees for spec §11 (read-only Google Docs integration).
 * These scan the shipped source and manifest so a future change cannot quietly add write access.
 */

const root = resolve(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}
const sources = files(join(root, 'src')).map((p) => ({ p, text: readFileSync(p, 'utf8') }));

describe('read-only Google Docs integration', () => {
  it('requests only the read-only Docs scope', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.base.json'), 'utf8'));
    expect(manifest.oauth2.scopes).toEqual(['https://www.googleapis.com/auth/documents.readonly']);
    expect(manifest.permissions).not.toContain('scripting');
    expect(manifest.permissions).not.toContain('tabs');
  });

  it('contains no Docs write endpoints or write scopes', () => {
    for (const { p, text } of sources) {
      expect(text, p).not.toMatch(/batchUpdate/);
      expect(text, p).not.toMatch(/auth\/documents['"`]/); // full (write) Docs scope
      // drive.file (files NotePilot creates itself) is the only Drive scope allowed.
      expect(text, p).not.toMatch(/auth\/drive(?!\.file['"`])/);
    }
  });

  it('only the companion-doc exporter talks to Google Drive, and only through the upload endpoint', () => {
    for (const { p, text } of sources) {
      if (p.endsWith('google/driveExport.ts')) continue;
      expect(text, p).not.toMatch(/googleapis\.com\/(upload\/)?drive/);
    }
    const drive = sources.find((s) => s.p.endsWith('google/driveExport.ts'))!.text;
    expect(drive).not.toMatch(/docs\.googleapis\.com/);
    expect([...drive.matchAll(/https:\/\/[^'"`\s$]+/g)].map((m) => m[0])).toEqual(['https://www.googleapis.com/upload/drive/v3/files', 'https://docs.google.com/document/d/']);
    const methods = new Set([...drive.matchAll(/'(GET|POST|PUT|PATCH|DELETE)'/g)].map((m) => m[1]));
    expect([...methods].sort()).toEqual(['PATCH', 'POST']);
    expect(drive).not.toMatch(/method:\s*'DELETE'|\/copy|\/permissions/);
  });

  it('only ever issues GET requests to the Docs API', () => {
    const docsApi = sources.find((s) => s.p.endsWith('google/docsApi.ts'))!.text;
    const methods = [...docsApi.matchAll(/method:\s*'([A-Z]+)'/g)].map((m) => m[1]);
    expect(methods).toEqual(['GET']);
  });

  it('the content script never touches document content, selection or focus', () => {
    const content = sources.find((s) => s.p.endsWith('content/activity.ts'))!.text;
    for (const forbidden of [/execCommand/, /\.focus\(/, /getSelection/, /innerHTML|textContent|innerText/, /preventDefault/, /dispatchEvent/, /\.value\s*=/]) {
      expect(content).not.toMatch(forbidden);
    }
  });
});
