import { createPipelines } from '../ai/pipelines';
import { UsageTracker } from '../ai/usage';
import { endpointOrigin, isAIConfigured, type Settings } from '../core/settings';
import type { ProcessGate } from '../engine/syncEngine';
import { auth } from '../google/auth';
import { createDocsClient } from '../google/docsApi';
import { indexedDbStore, memoryStore, responseCache, type DocStore } from '../storage/db';
import { usagePersistence } from '../storage/settingsStore';

/** Long-lived singletons for the side panel page. */
let currentSettings: Settings | null = null;
export const getSettings = (): Settings => {
  if (!currentSettings) throw new Error('settings not loaded');
  return currentSettings;
};
export const setRuntimeSettings = (s: Settings) => {
  currentSettings = s;
};

export const usage = new UsageTracker(usagePersistence);
void usage.init();

export const docsClient = createDocsClient(auth);
export const pipelines = createPipelines(getSettings, usage, responseCache);

const volatileStore = memoryStore();
export const storeFor = (s: Settings): DocStore => (s.privacy.storeLocally ? indexedDbStore : volatileStore);

/** Decides whether note content may be sent to the AI provider right now. */
/** Whether note text may be sent to the AI. `manual`: an explicit click (ignores the "automatic processing" switch). */
export function gateFor(docId: string, opts: { manual?: boolean } = {}): ProcessGate {
  const s = getSettings();
  if (!s.autoProcess && !opts.manual) return { ok: false, reason: 'disabled' };
  if (!isAIConfigured(s.ai)) return { ok: false, reason: 'not_configured' };
  if (!s.consent || s.consent.endpointOrigin !== endpointOrigin(s.ai)) return { ok: false, reason: 'no_consent' };
  if (s.privacy.excludedDocs.includes(docId)) return { ok: false, reason: 'excluded' };
  if (s.privacy.perDocApproval && !s.privacy.approvedDocs.includes(docId)) return { ok: false, reason: 'needs_approval' };
  if (usage.overBudget(s.dailyBudgetUSD)) return { ok: false, reason: 'budget' };
  return { ok: true };
}

/**
 * Asks Chrome for permission to reach the configured AI endpoint. Must be the first await inside
 * a click handler (user gesture). Match patterns cannot carry ports, so the port is dropped.
 */
export async function requestEndpointPermission(s: Settings): Promise<boolean> {
  let pattern: string;
  try {
    const u = new URL(s.ai.mode === 'proxy' ? s.ai.proxyUrl : s.ai.baseUrl);
    pattern = `${u.protocol}//${u.hostname}/*`;
  } catch {
    return false;
  }
  try {
    return await chrome.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}
