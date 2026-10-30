import { useEffect, useState } from 'react';
import { chatCompletion } from '../../ai/client';
import { PROVIDER_PRESETS, endpointOrigin, isAIConfigured, type AISettings, type Settings } from '../../core/settings';
import { requestEndpointPermission } from '../runtime';
import { Button, Segmented, cx } from './ui';

export const inputCls =
  'np-focus h-8 w-full rounded-md border border-ink-200 bg-white px-2.5 text-[12.5px] text-ink-900 placeholder:text-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-600';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-[11.5px] font-medium text-ink-600 dark:text-ink-300">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-ink-400">{hint}</p>}
    </div>
  );
}

/** Configures the OpenAI-compatible endpoint. Testing sends a tiny probe — never note content. */
export function AIConnectionForm({ settings, update, compact }: { settings: Settings; update: (fn: (s: Settings) => Settings) => void; compact?: boolean }) {
  const [draft, setDraft] = useState<AISettings>(settings.ai);
  const [state, setState] = useState<{ kind: 'idle' | 'testing' | 'ok' | 'error'; msg?: string }>({ kind: 'idle' });
  useEffect(() => setDraft(settings.ai), [settings.ai]);
  const set = (patch: Partial<AISettings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setState({ kind: 'idle' });
  };

  const connect = async () => {
    // Host permission for the endpoint must be requested from this click (user gesture).
    const granted = await requestEndpointPermission({ ...settings, ai: draft });
    if (!granted) {
      setState({ kind: 'error', msg: `Chrome permission to contact ${endpointOrigin(draft)} was not granted.` });
      return;
    }
    setState({ kind: 'testing' });
    try {
      const r = await chatCompletion(draft, {
        model: draft.fastModel,
        messages: [{ role: 'user', content: 'Reply with exactly this JSON and nothing else: {"ok": true}' }],
        maxTokens: 20,
        jsonMode: 'prompt_only',
      });
      setState({ kind: 'ok', msg: `Connected · ${r.model} · ${r.latencyMs} ms` });
      update((s) => ({ ...s, ai: draft }));
    } catch (e) {
      setState({ kind: 'error', msg: e instanceof Error ? e.message : String(e) });
    }
  };

  const configured = isAIConfigured(draft);
  return (
    <div className="space-y-3">
      <Segmented
        label="Connection type"
        value={draft.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'direct', label: 'My API key' },
          { value: 'proxy', label: 'NotePilot server' },
        ]}
      />
      {draft.mode === 'direct' ? (
        <>
          <Field label="Provider">
            <select
              className={inputCls}
              value={PROVIDER_PRESETS.find((p) => p.baseUrl === draft.baseUrl)?.label ?? 'custom'}
              onChange={(e) => {
                const p = PROVIDER_PRESETS.find((x) => x.label === e.target.value);
                if (p) set({ baseUrl: p.baseUrl, fastModel: p.fast, deepModel: p.deep, jsonMode: p.jsonMode });
              }}
            >
              {PROVIDER_PRESETS.map((p) => (
                <option key={p.label}>{p.label}</option>
              ))}
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </Field>
          <Field label="Base URL" htmlFor="np-base">
            <input id="np-base" className={inputCls} value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value.trim() })} spellCheck={false} />
          </Field>
          <Field label="API key" hint="Stored only in this browser profile (never synced). Only sent to the base URL above." htmlFor="np-key">
            <input id="np-key" type="password" autoComplete="off" className={inputCls} value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value.trim() })} placeholder="sk-…" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Server URL" hint="Your deployment of the NotePilot server (see README). It holds the provider key." htmlFor="np-proxy">
            <input id="np-proxy" className={inputCls} value={draft.proxyUrl} onChange={(e) => set({ proxyUrl: e.target.value.trim() })} spellCheck={false} />
          </Field>
          <Field label="Access token" htmlFor="np-token">
            <input id="np-token" type="password" autoComplete="off" className={inputCls} value={draft.proxyToken} onChange={(e) => set({ proxyToken: e.target.value.trim() })} />
          </Field>
        </>
      )}
      <div className={cx('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2')}>
        <Field label="Fast model (rewriting)" htmlFor="np-fast">
          <input id="np-fast" className={inputCls} value={draft.fastModel} onChange={(e) => set({ fastModel: e.target.value.trim() })} spellCheck={false} />
        </Field>
        <Field label="Deep model (insights)" htmlFor="np-deep">
          <input id="np-deep" className={inputCls} value={draft.deepModel} onChange={(e) => set({ deepModel: e.target.value.trim() })} spellCheck={false} />
        </Field>
      </div>
      {!compact && (
        <Field label="Structured output" hint="Use JSON schema if your provider supports strict structured outputs; plain prompting works everywhere.">
          <select className={inputCls} value={draft.jsonMode} onChange={(e) => set({ jsonMode: e.target.value as AISettings['jsonMode'] })}>
            <option value="json_object">JSON mode (response_format: json_object)</option>
            <option value="json_schema">Strict JSON schema</option>
            <option value="prompt_only">Prompt only</option>
          </select>
        </Field>
      )}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => void connect()} disabled={!configured || state.kind === 'testing'}>
          {state.kind === 'testing' ? 'Testing…' : 'Connect & test'}
        </Button>
        {state.kind === 'ok' && <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400">{state.msg}</span>}
      </div>
      {state.kind === 'error' && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11.5px] text-red-700 dark:bg-red-500/10 dark:text-red-300">{state.msg}</p>}
    </div>
  );
}
