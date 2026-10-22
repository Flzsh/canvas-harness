import type { CSSProperties, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { COMPANION_SUFFIX } from '../core/companion';
import { CATEGORY_LABEL } from '../core/export';
import { FILL_CLASS, remarkFills } from '../core/fills';
import { CATEGORY_ORDER } from '../core/insights';
import { latexToHtml } from '../core/latexText';
import { sectionOrder } from '../core/patch';
import type { DocSummary } from '../core/summary';
import type { Insight, OrganizedDoc, OrgUnit } from '../core/types';

/**
 * Builds the HTML that Google Drive converts into the companion Google Doc:
 *   Title · Summary · Organized notes · Insights.
 * Google's HTML import keeps headings (→ the Docs outline), lists, tables, bold/italic and
 * inline colours, so all styling is inline. Math is converted to text with sub/superscripts.
 */

export interface ExportInput {
  organized: OrganizedDoc;
  insights: Insight[];
  summary: DocSummary | null;
  sourceTitle: string;
  sourceDocId: string;
  includeExpansions: boolean;
  now?: number;
}

const C = {
  muted: '#5f6368',
  fill: '#dbeafe',
  clarify: '#1a73e8',
  expansionBg: '#f3f0ff',
  expansionInk: '#6d28d9',
  warn: '#b45309',
  border: '#c7c7c7',
  headBg: '#f1f3f4',
};

const cell: CSSProperties = { border: `1px solid ${C.border}`, padding: '4px 8px', verticalAlign: 'top' };
const small = (color = C.muted): CSSProperties => ({ fontSize: '9pt', color, margin: '0' });

const mdComponents: Components = {
  table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%' }}>{children}</table>,
  th: ({ children }) => <th style={{ ...cell, background: C.headBg, textAlign: 'left', fontWeight: 'bold' }}>{children}</th>,
  td: ({ children }) => <td style={cell}>{children}</td>,
  span: ({ className, children }) =>
    String(className ?? '').includes(FILL_CLASS) ? <span style={{ backgroundColor: C.fill }}>{children}</span> : <span>{children}</span>,
  code: ({ className, children }) => {
    const cls = String(className ?? '');
    if (cls.includes('math')) return <span style={{ fontFamily: 'Cambria Math, Times New Roman, serif' }} dangerouslySetInnerHTML={{ __html: latexToHtml(String(children)) }} />;
    return <span style={{ fontFamily: 'Courier New, monospace' }}>{children}</span>;
  },
  pre: ({ children }) => <p style={{ textAlign: 'center' }}>{children}</p>,
  a: ({ href, children }) => <a href={/^(https?:|mailto:)/i.test(href ?? '') ? href : undefined}>{children}</a>,
  img: () => null,
};

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, [remarkFills, { mark: true }]]} skipHtml components={mdComponents}>
      {text}
    </ReactMarkdown>
  );
}

/** Markdown rendered without the surrounding paragraph, for list items and table cells. */
function MdInline({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, [remarkFills, { mark: true }]]} skipHtml components={{ ...mdComponents, p: ({ children }) => <>{children}</> }}>
      {text}
    </ReactMarkdown>
  );
}

function Label({ children, color }: { children: ReactNode; color: string }) {
  return <p style={{ ...small(color), fontSize: '8pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>{children}</p>;
}

function Unit({ unit, includeExpansions }: { unit: OrgUnit; includeExpansions: boolean }) {
  if (unit.origin === 'expansion') {
    if (!includeExpansions) return null;
    return (
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, border: `1px solid #ddd6fe`, background: C.expansionBg }}>
              <Label color={C.expansionInk}>AI EXPANSION · UNVERIFIED</Label>
              <Md text={unit.content} />
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
  return (
    <>
      {unit.origin === 'clarification' && <Label color={C.clarify}>AI CLARIFICATION</Label>}
      {unit.needsReview && <Label color={C.muted}>NOT YET ORGANIZED (AS WRITTEN)</Label>}
      <Md text={unit.content} />
      {unit.uncertain && (
        <p style={small(C.warn)}>
          <i>Unclear in your notes: {unit.uncertain}</i>
        </p>
      )}
    </>
  );
}

function sectionNames(doc: OrganizedDoc, ids: string[]): string {
  return ids
    .map((id) => doc.sections[id]?.title)
    .filter(Boolean)
    .join(', ');
}

function SeeAlso({ doc, ids }: { doc: OrganizedDoc; ids: string[] }) {
  const names = sectionNames(doc, ids);
  return names ? <span style={{ color: C.muted }}> (see {names})</span> : null;
}

function ExportDocument(p: ExportInput) {
  const { organized: doc, summary, insights } = p;
  const now = new Date(p.now ?? Date.now());
  const title = doc.title || p.sourceTitle || 'Organized notes';
  const sourceUrl = `https://docs.google.com/document/d/${encodeURIComponent(p.sourceDocId)}/edit`;
  const H = ({ level, children }: { level: number; children: ReactNode }) => {
    const Tag = `h${Math.min(Math.max(level, 1), 6)}` as 'h1';
    return <Tag>{children}</Tag>;
  };

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
      </head>
      <body style={{ fontFamily: 'Arial, sans-serif', fontSize: '11pt' }}>
        <p style={{ fontSize: '24pt', fontWeight: 'bold', margin: '0 0 4px' }}>{title}</p>
        <p style={small()}>
          Organized by NotePilot AI from <a href={sourceUrl}>{p.sourceTitle || 'your notes'}</a> · Updated{' '}
          {now.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <p style={small()}>
          <span style={{ backgroundColor: C.fill }}>Highlighted words</span> were added by AI to finish incomplete notes. AI clarifications, expansions, the summary and the insights are AI-generated; items marked unverified were not checked against a source. This document is replaced each time you click Summarize in NotePilot, so make your edits in your original notes.
        </p>

        {summary && (
          <>
            <h1>Summary</h1>
            <Md text={summary.overview} />
            {summary.sections.map((sec) => (
              <div key={sec.sectionId}>
                <H level={sec.depth + 1}>{sec.title}</H>
                {sec.content && <Md text={sec.content} />}
              </div>
            ))}
            {summary.keyTerms.length > 0 && (
              <>
                <h2>Key Terms</h2>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ ...cell, background: C.headBg, textAlign: 'left', width: '28%' }}>Term</th>
                      <th style={{ ...cell, background: C.headBg, textAlign: 'left' }}>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.keyTerms.map((t, i) => (
                      <tr key={i}>
                        <td style={{ ...cell, fontWeight: 'bold' }}>{t.term}</td>
                        <td style={cell}>
                          <MdInline text={t.definition} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {summary.review.length > 0 && (
              <>
                <h2>Review Next</h2>
                <ul>
                  {summary.review.map((r, i) => (
                    <li key={i}>
                      <MdInline text={r.text} />
                      <SeeAlso doc={doc} ids={r.sectionIds} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <h1>Organized notes</h1>
        {sectionOrder(doc).map(({ id, depth }) => {
          const s = doc.sections[id];
          return (
            <div key={id}>
              <H level={depth + 1}>{s.title}</H>
              {s.units.map((uid) => doc.units[uid] && <Unit key={uid} unit={doc.units[uid]} includeExpansions={p.includeExpansions} />)}
            </div>
          );
        })}

        {insights.length > 0 && (
          <>
            <h1>Insights</h1>
            <p style={small()}>AI-generated study insights about these notes.</p>
            {CATEGORY_ORDER.map((cat) => {
              const items = insights.filter((i) => i.category === cat);
              if (!items.length) return null;
              return (
                <div key={cat}>
                  <h2>{CATEGORY_LABEL[cat]}</h2>
                  {items.map((i) => (
                    <div key={i.id}>
                      <p>
                        <b>{i.title}</b>
                        {i.needsVerification && <span style={{ color: C.warn }}> (unverified)</span>}
                        {i.severity && cat === 'error' && <span style={{ color: C.muted }}> · {i.severity} severity</span>}
                      </p>
                      <Md text={i.body} />
                      {i.question && (
                        <>
                          <p>
                            <b>Question: </b>
                          </p>
                          <Md text={i.question.prompt} />
                          {i.question.answer && (
                            <>
                              <p>
                                <b>Answer: </b>
                              </p>
                              <Md text={i.question.answer} />
                            </>
                          )}
                        </>
                      )}
                      {sectionNames(doc, i.sectionIds) && <p style={small()}>Related: {sectionNames(doc, i.sectionIds)}</p>}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </body>
    </html>
  );
}

export function buildExportHtml(input: ExportInput): string {
  return '<!DOCTYPE html>' + renderToStaticMarkup(<ExportDocument {...input} />);
}

export function exportDocName(doc: OrganizedDoc, sourceTitle: string): string {
  return `${(doc.title || sourceTitle || 'Notes').slice(0, 120)}${COMPANION_SUFFIX}`;
}
