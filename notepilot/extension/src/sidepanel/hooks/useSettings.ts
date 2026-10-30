import { useCallback, useEffect, useRef, useState } from 'react';
import type { Settings } from '../../core/settings';
import { loadSettings, onSettingsChanged, saveSettings } from '../../storage/settingsStore';
import { setRuntimeSettings } from '../runtime';

export function useSettings(): [Settings | null, (update: (s: Settings) => Settings) => void] {
  const [settings, setSettings] = useState<Settings | null>(null);
  const ref = useRef<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    void loadSettings().then((s) => {
      if (!alive) return;
      ref.current = s;
      setRuntimeSettings(s);
      setSettings(s);
    });
    const off = onSettingsChanged((s) => {
      ref.current = s;
      setRuntimeSettings(s);
      setSettings(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const update = useCallback((fn: (s: Settings) => Settings) => {
    if (!ref.current) return;
    const next = fn(ref.current);
    ref.current = next;
    setRuntimeSettings(next);
    setSettings(next);
    void saveSettings(next);
  }, []);

  return [settings, update];
}
