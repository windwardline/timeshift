'use client';

import { useEffect, useState } from 'react';
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
  try {
    const s = window.localStorage;
    s.getItem(THEME_KEY);
    return s;
  } catch {
    return null;
  }
}

/** Day / night / local time. Local time follows the device — fitting, for an
 *  app whose whole job is knowing what time it is where you're going. */
export function ThemeLamp({ storage }: { storage?: LampStorage }) {
  const [choice, setChoice] = useState<ThemeChoice>('system');
  const [store, setStore] = useState<LampStorage | null>(storage ?? null);

  useEffect(() => {
    const s = storage ?? defaultStorage();
    setStore(s);
    if (s) setChoice(normalizeStored(s.getItem(THEME_KEY)));
  }, [storage]);

  function pick(next: ThemeChoice) {
    if (store) {
      applyChoice(document.documentElement, store, next);
    } else if (next === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
    setChoice(next);
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
