import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkFills } from '../../core/fills';

/**
 * Safe markdown renderer for AI-generated content.
 *  - No raw HTML (react-markdown escapes it).
 *  - No images: model output can never make the panel load a remote URL (blocks data exfiltration
 *    via prompt-injected image links). The extension CSP also forbids remote images.
 *  - Links only for http(s)/mailto, opened in a new tab without referrer.
 */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={href}>
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
};

const safeUrl = (url: string) => (/^(https?:|mailto:)/i.test(url) ? url : '');

// Words the AI added to finish an unfinished note arrive wrapped in markers (see core/fills.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MARKED: any[] = [remarkGfm, remarkMath, [remarkFills, { mark: true }]];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UNMARKED: any[] = [remarkGfm, remarkMath, [remarkFills, { mark: false }]];

export const Markdown = memo(function Markdown({
  text,
  className = 'np-prose',
  markFills = true,
}: {
  text: string;
  className?: string;
  /** Highlight AI-completed words; when false the markers are simply removed. */
  markFills?: boolean;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={markFills ? MARKED : UNMARKED}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        disallowedElements={['img', 'iframe', 'script', 'style']}
        unwrapDisallowed
        skipHtml
        urlTransform={safeUrl}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
