'use client';

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  applyChoice,
  normalizeStored,
  THEME_KEY,
  type ThemeChoice,
} from '../lib/theme/theme';

export type LampStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const OPTIONS: Array<{ choice: ThemeChoice; label: string }> = [
  { choice: 'light', label: 'Day' },
  { choice: 'dark', label: 'Night' },
  { choice: 'system', label: 'Local time' },
];

function defaultStorage(): LampStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    window.localStorage.getItem(THEME_KEY);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Day / night / local time. Local time follows the device — fitting, for an
 *  app whose whole job is knowing what time it is where you're going. */
export function ThemeLamp({ storage }: { storage?: LampStorage }) {
  const store = useMemo(() => storage ?? defaultStorage(), [storage]);
  const listeners = useRef(new Set<() => void>());

  const subscribe = useCallback((cb: () => void) => {
    listeners.current.add(cb);
    window.addEventListener('storage', cb);
    return () => {
      listeners.current.delete(cb);
      window.removeEventListener('storage', cb);
    };
  }, []);

  const choice = useSyncExternalStore<ThemeChoice>(
    subscribe,
    () => normalizeStored(store?.getItem(THEME_KEY) ?? null),
    () => 'system',
  );

  function pick(next: ThemeChoice) {
    if (store) {
      applyChoice(document.documentElement, store, next);
    } else if (next === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
    listeners.current.forEach((cb) => cb());
  }

  return (
    <div className="lamp" role="group" aria-label="Theme">
      {OPTIONS.map(({ choice: value, label }) => (
        <button
          key={value}
          type="button"
          className="lamp-opt"
          aria-pressed={choice === value}
          onClick={() => pick(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
