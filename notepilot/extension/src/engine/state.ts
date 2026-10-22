import type { Insight, OrganizedDoc, SourceBlock, SourceSnapshot } from '../core/types';
import { emptyOrganizedDoc } from '../core/types';

/** Everything persisted per Google Doc. */
export interface DocState {
  schema: 1;
  docId: string;
  title: string;
  /** Latest fetched source snapshot (block ids assigned). */
  current: SourceSnapshot | null;
  /** Source blocks the organized document currently reflects. */
  processed: SourceBlock[];
  processedVersion: number;
  organized: OrganizedDoc;
  insights: Insight[];
  nextBlockId: number;
  nextInsightId: number;
  /** id → time of last change, for "recently updated" indicators. */
  recent: Record<string, number>;
  insightsDirtySections: string[];
  insightsOrgVersion: number;
  lastInsightsAt: number;
  metrics: Metrics;
}

export interface Metrics {
  /** Change first detected in the Docs API → organized notes updated (ms). */
  detectToRender: number[];
  /** Last keystroke observed before the update was captured → organized notes updated (ms). */
  typeToRender: number[];
  /** Model call latency (ms). */
  aiLatency: number[];
  staleRejected: number;
  cancelled: number;
  repairs: number;
  fallbacks: number;
}

export function emptyDocState(docId: string, now = Date.now()): DocState {
  return {
    schema: 1,
    docId,
    title: '',
    current: null,
    processed: [],
    processedVersion: 0,
    organized: emptyOrganizedDoc(docId, now),
    insights: [],
    nextBlockId: 1,
    nextInsightId: 1,
    recent: {},
    insightsDirtySections: [],
    insightsOrgVersion: 0,
    lastInsightsAt: 0,
    metrics: { detectToRender: [], typeToRender: [], aiLatency: [], staleRejected: 0, cancelled: 0, repairs: 0, fallbacks: 0 },
  };
}

export function pushMetric(arr: number[], v: number, max = 50): void {
  arr.push(Math.round(v));
  if (arr.length > max) arr.splice(0, arr.length - max);
}

export function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export type EngineStatus =
  | 'starting'
  | 'live'
  | 'checking'
  | 'pending'
  | 'rewriting'
  | 'paused'
  | 'needs_setup'
  | 'needs_consent'
  | 'needs_approval'
  | 'excluded'
  | 'budget'
  | 'needs_auth'
  | 'offline'
  | 'error';

export interface EngineView {
  docId: string;
  title: string;
  status: EngineStatus;
  statusDetail: string;
  lastCheckedAt: number;
  lastUpdatedAt: number;
  organized: OrganizedDoc;
  insights: Insight[];
  blocks: SourceBlock[];
  pendingChanges: number;
  insightsBusy: boolean;
  recent: Record<string, number>;
  metrics: Metrics;
  pollIntervalMs: number;
  docsRequestsPerMin: number;
  role: 'leader' | 'follower';
}
