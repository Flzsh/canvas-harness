import type { ReactNode } from 'react';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

/** Section heading type, shared by the organized notes and the summary so both read the same. */
export function sectionHeadingClass(depth: number): string {
  return cx(
    depth === 1 && 'border-b border-ink-100 pb-1 text-[15.5px] font-semibold tracking-[-0.01em] text-ink-900 dark:border-ink-800 dark:text-ink-50',
    depth === 2 && 'text-[13.5px] font-semibold text-ink-800 dark:text-ink-100',
    depth >= 3 && 'text-[12.5px] font-semibold text-ink-600 dark:text-ink-300',
  );
}

const paths: Record<string, ReactNode> = {
  chevron: <path d="M6 4l4 4-4 4" />,
  outline: (
    <>
      <path d="M3 4h10M5.5 8H13M8 12h5" />
      <circle cx="3" cy="8" r=".6" fill="currentColor" />
      <circle cx="5.5" cy="12" r=".6" fill="currentColor" />
    </>
  ),
  source: (
    <>
      <path d="M4 2.5h5.5L12 5v8.5H4z" />
      <path d="M9.5 2.5V5H12M6 8h4M6 10.5h4" />
    </>
  ),
  refresh: (
    <>
      <path d="M13 4v3h-3" />
      <path d="M12.6 7A5 5 0 1 0 13 9.5" />
    </>
  ),
  more: (
    <>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  link: <path d="M7 9l2-2M6 11l-1 1a2 2 0 0 1-3-3l2-2a2 2 0 0 1 3 0M10 5l1-1a2 2 0 0 1 3 3l-2 2a2 2 0 0 1-3 0" />,
  warn: (
    <>
      <path d="M8 2.5l6 10.5H2z" />
      <path d="M8 6.5v3M8 11.2v.3" />
    </>
  ),
  spark: <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />,
  connection: (
    <>
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M5.8 7.1l4.4-2.2M5.8 8.9l4.4 2.2" />
    </>
  ),
  deeper: (
    <>
      <path d="M2.5 4.5h11M4 8h8M6 11.5h4" />
    </>
  ),
  gap: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6.3 6.4a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.3M8 11.3v.2" />
    </>
  ),
  practice: (
    <>
      <path d="M3 3.5h10v7H7l-3 2.5v-2.5H3z" />
    </>
  ),
  check: <path d="M3.5 8.5l3 3 6-7" />,
  copy: (
    <>
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 10.5V4a1 1 0 0 1 1-1h6.5" />
    </>
  ),
  download: <path d="M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10" />,
  summary: (
    <>
      <path d="M3 3.5h10M3 6.5h10M3 9.5h6" />
      <path d="M11.5 9.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" strokeWidth={0.8} />
    </>
  ),
  doc: (
    <>
      <path d="M4 1.8h5.5L12.5 5v9.2H4z" fill="#4285F4" stroke="none" />
      <path d="M9.5 1.8V5h3" fill="#A1C2FA" stroke="none" />
      <path d="M6 8h4.5M6 10h4.5M6 12h3" stroke="#fff" strokeWidth={1} />
    </>
  ),
  external: <path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5" />,
  google: (
    <>
      <path d="M13.5 8.2c0-.4 0-.8-.1-1.2H8v2.3h3.1a2.7 2.7 0 0 1-1.2 1.8v1.5h1.9c1.1-1 1.7-2.5 1.7-4.4z" fill="#4285F4" stroke="none" />
      <path d="M8 14c1.6 0 2.9-.5 3.9-1.4L10 11.1c-.5.4-1.2.6-2 .6-1.5 0-2.8-1-3.3-2.4H2.8v1.5A6 6 0 0 0 8 14z" fill="#34A853" stroke="none" />
      <path d="M4.7 9.3a3.6 3.6 0 0 1 0-2.3V5.5H2.8a6 6 0 0 0 0 5.3z" fill="#FBBC05" stroke="none" />
      <path d="M8 4.4c.9 0 1.6.3 2.2.9l1.7-1.7A6 6 0 0 0 2.8 5.5L4.7 7C5.2 5.5 6.5 4.4 8 4.4z" fill="#EA4335" stroke="none" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export function Icon({ name, className = 'w-3.5 h-3.5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function Logo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" className="fill-ink-900 dark:fill-ink-100" />
      <path d="M7 16.5V7.5l10 9V7.5" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stroke-white dark:stroke-ink-900" />
      <circle cx="17" cy="7.5" r="1.6" className="fill-amber-400" />
    </svg>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled,
  title,
  className,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'np-focus inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none',
        size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-8 px-3 text-[12.5px]',
        variant === 'primary' && 'bg-ink-900 text-white hover:bg-ink-700 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white',
        variant === 'secondary' && 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800',
        variant === 'ghost' && 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
        variant === 'danger' && 'border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'np-focus relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-ink-900 dark:bg-ink-100' : 'bg-ink-200 dark:bg-ink-700',
      )}
    >
      <span
        className={cx(
          'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform dark:bg-ink-900',
          checked ? 'translate-x-[15px]' : 'translate-x-[2px]',
          !checked && 'dark:bg-ink-300',
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-ink-100 p-0.5 dark:bg-ink-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'np-focus rounded-[5px] font-medium transition-colors',
            size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11.5px]',
            o.value === value
              ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white'
              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'violet' | 'sky' | 'amber' | 'red' | 'green'; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-wide',
        tone === 'neutral' && 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
        tone === 'violet' && 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
        tone === 'sky' && 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
        tone === 'amber' && 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
        tone === 'red' && 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
        tone === 'green' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      )}
    >
      {children}
    </span>
  );
}

export function relativeTime(ts: number, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}
