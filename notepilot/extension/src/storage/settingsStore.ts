import { mergeSettings, type Settings } from '../core/settings';
import type { DailyUsage, UsagePersistence } from '../ai/usage';

/**
 * Settings live in chrome.storage.local (never chrome.storage.sync, so an API key is never
 * synced to other devices).
 */
const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(KEY);
  return mergeSettings(r[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: s });
}

export function onSettingsChanged(fn: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) fn(mergeSettings(changes[KEY].newValue as Partial<Settings>));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export const usagePersistence: UsagePersistence = {
  async load() {
    return ((await chrome.storage.local.get('usage')).usage as DailyUsage | undefined) ?? null;
  },
  async save(u) {
    await chrome.storage.local.set({ usage: u });
  },
};

/** Per-document UI state (collapsed sections). */
export async function loadCollapsed(docId: string): Promise<string[]> {
  const k = `collapsed:${docId}`;
  return ((await chrome.storage.local.get(k))[k] as string[] | undefined) ?? [];
}
export async function saveCollapsed(docId: string, ids: string[]): Promise<void> {
  await chrome.storage.local.set({ [`collapsed:${docId}`]: ids });
}

export async function clearAllLocalSettingsData(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k !== KEY));
}
