import { describe, expect, it } from 'vitest';
import { applyChoice, normalizeStored, resolveTheme, THEME_KEY } from './theme';

describe('normalizeStored', () => {
  it('passes through the two explicit choices', () => {
    expect(normalizeStored('light')).toBe('light');
    expect(normalizeStored('dark')).toBe('dark');
  });

  it('treats anything else as system', () => {
    expect(normalizeStored(null)).toBe('system');
    expect(normalizeStored('')).toBe('system');
    expect(normalizeStored('twilight')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('honors an explicit choice regardless of the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('follows the OS when the choice is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('applyChoice', () => {
  function harness() {
    const attrs = new Map<string, string>();
    const store = new Map<string, string>();
    return {
      root: {
        setAttribute: (k: string, v: string) => attrs.set(k, v),
        removeAttribute: (k: string) => attrs.delete(k),
      },
      storage: {
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
      attrs,
      store,
    };
  }

  it('sets the attribute and persists an explicit choice', () => {
    const h = harness();
    applyChoice(h.root, h.storage, 'dark');
    expect(h.attrs.get('data-theme')).toBe('dark');
    expect(h.store.get(THEME_KEY)).toBe('dark');
  });

  it('clears both for system — local time is the absence of a choice', () => {
    const h = harness();
    applyChoice(h.root, h.storage, 'light');
    applyChoice(h.root, h.storage, 'system');
    expect(h.attrs.has('data-theme')).toBe(false);
    expect(h.store.has(THEME_KEY)).toBe(false);
  });
});
