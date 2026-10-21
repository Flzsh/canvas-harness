import { z } from 'zod';

/**
 * Structured AI response formats. Every model response is parsed and validated against these
 * schemas before anything is applied to the organized document.
 */

const unitTypes = ['paragraph', 'list', 'table', 'equation', 'definition', 'example', 'callout'] as const;
const origins = ['user', 'clarification', 'expansion'] as const;

const idRef = z.string().trim().min(1).max(64);
const nullableIdRef = idRef.nullable();
const unitType = z.enum(unitTypes).catch('paragraph');
const origin = z.enum(origins);
const sources = z.array(idRef).max(200);
const concepts = z.array(z.string().trim().min(1).max(60)).max(12);
const content = z.string().max(12_000);

export const createSectionOp = z.object({
  op: z.literal('create_section'),
  ref: idRef,
  title: z.string().trim().min(1).max(160),
  parent: nullableIdRef.optional().default(null),
  after: nullableIdRef.optional().default(null),
});
export const updateSectionOp = z.object({
  op: z.literal('update_section'),
  id: idRef,
  title: z.string().trim().min(1).max(160).optional(),
  parent: nullableIdRef.optional(),
  after: nullableIdRef.optional(),
});
export const deleteSectionOp = z.object({ op: z.literal('delete_section'), id: idRef });
export const createUnitOp = z.object({
  op: z.literal('create_unit'),
  ref: idRef,
  section: idRef,
  after: nullableIdRef.optional().default(null),
  type: unitType.optional().default('paragraph'),
  content: content.min(1),
  origin: origin,
  sources: sources.default([]),
  concepts: concepts.optional().default([]),
  uncertain: z.string().max(400).nullable().optional(),
});
export const updateUnitOp = z.object({
  op: z.literal('update_unit'),
  id: idRef,
  content: content.min(1).optional(),
  type: unitType.optional(),
  origin: origin.optional(),
  sources: sources.optional(),
  concepts: concepts.optional(),
  uncertain: z.string().max(400).nullable().optional(),
});
export const moveUnitOp = z.object({
  op: z.literal('move_unit'),
  id: idRef,
  section: idRef,
  after: nullableIdRef.optional().default(null),
});
export const deleteUnitOp = z.object({ op: z.literal('delete_unit'), id: idRef });

export const patchOp = z.discriminatedUnion('op', [
  createSectionOp,
  updateSectionOp,
  deleteSectionOp,
  createUnitOp,
  updateUnitOp,
  moveUnitOp,
  deleteUnitOp,
]);
export type PatchOp = z.infer<typeof patchOp>;

export const rewriteResponse = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  ops: z.array(z.unknown()).max(400),
});
export type RewriteResponse = { title?: string | null; ops: PatchOp[]; invalidOps: { op: unknown; error: string }[] };

/** Parses a rewrite response; individually invalid ops are reported instead of failing the whole patch. */
export function parseRewriteResponse(json: unknown): RewriteResponse {
  const top = rewriteResponse.parse(json);
  const ops: PatchOp[] = [];
  const invalidOps: { op: unknown; error: string }[] = [];
  for (const raw of top.ops) {
    const r = patchOp.safeParse(raw);
    if (r.success) ops.push(r.data);
    else invalidOps.push({ op: raw, error: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  return { title: top.title ?? null, ops, invalidOps };
}

const insightCategory = z.enum(['connection', 'deeper', 'error', 'gap', 'practice']);
export const insightItem = z.object({
  id: idRef.optional(),
  category: insightCategory,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
  sectionIds: z.array(idRef).max(20).default([]),
  unitIds: z.array(idRef).max(40).default([]),
  confidence: z.enum(['low', 'medium', 'high']).catch('medium').default('medium'),
  needsVerification: z.boolean().default(true),
  severity: z.enum(['low', 'medium', 'high']).optional().catch(undefined),
  question: z
    .object({ prompt: z.string().trim().min(1).max(1000), answer: z.string().max(2000).optional() })
    .nullable()
    .optional(),
});
export const insightsResponse = z.object({
  upsert: z.array(z.unknown()).max(60).default([]),
  remove: z.array(idRef).max(200).default([]),
});
export type InsightItem = z.infer<typeof insightItem>;

export function parseInsightsResponse(json: unknown): { upsert: InsightItem[]; remove: string[]; invalid: number } {
  const top = insightsResponse.parse(json);
  const upsert: InsightItem[] = [];
  let invalid = 0;
  for (const raw of top.upsert) {
    const r = insightItem.safeParse(raw);
    if (r.success) upsert.push(r.data);
    else invalid++;
  }
  return { upsert, remove: top.remove, invalid };
}

/**
 * Extracts a JSON object from a model reply. Tolerates markdown code fences and leading/trailing
 * prose, which some OpenAI-compatible providers emit even when asked for JSON only.
 */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new SyntaxError('Model response did not contain a JSON object');
}

/** JSON Schema used with providers that support `response_format: { type: "json_schema" }`. */
export const REWRITE_JSON_SCHEMA = {
  name: 'notepilot_patch',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'ops'],
    properties: {
      title: { type: ['string', 'null'] },
      ops: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['op', 'id', 'ref', 'title', 'parent', 'after', 'section', 'type', 'content', 'origin', 'sources', 'concepts', 'uncertain'],
          properties: {
            op: { type: 'string', enum: ['create_section', 'update_section', 'delete_section', 'create_unit', 'update_unit', 'move_unit', 'delete_unit'] },
            id: { type: ['string', 'null'] },
            ref: { type: ['string', 'null'] },
            title: { type: ['string', 'null'] },
            parent: { type: ['string', 'null'] },
            after: { type: ['string', 'null'] },
            section: { type: ['string', 'null'] },
            type: { type: ['string', 'null'], enum: [...unitTypes, null] },
            content: { type: ['string', 'null'] },
            origin: { type: ['string', 'null'], enum: [...origins, null] },
            sources: { type: ['array', 'null'], items: { type: 'string' } },
            concepts: { type: ['array', 'null'], items: { type: 'string' } },
            uncertain: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const;

/**
 * Strict JSON-schema mode forces every key to be present (null when unused). This strips the
 * nulls back out so the op validators see the natural shape.
 */
export function stripNullOpFields(json: unknown): unknown {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { ops?: unknown }).ops)) return json;
  const j = json as { ops: Record<string, unknown>[] };
  return {
    ...j,
    ops: j.ops.map((op) => {
      if (!op || typeof op !== 'object') return op;
      const clean: Record<string, unknown> = {};
      const keepNull = op.op === 'create_section' || op.op === 'update_section' || op.op === 'create_unit' || op.op === 'move_unit';
      for (const [k, v] of Object.entries(op)) {
        if (v === null && !(keepNull && (k === 'parent' || k === 'after'))) continue;
        clean[k] = v;
      }
      if (op.op === 'update_section') {
        // In strict mode "parent": null is ambiguous (move-to-root vs. unchanged); treat as unchanged.
        if (op.parent === null) delete clean.parent;
        if (op.after === null) delete clean.after;
      }
      return clean;
    }),
  };
}
