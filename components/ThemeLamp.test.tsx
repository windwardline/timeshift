// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ThemeLamp, type LampStorage } from './ThemeLamp';

// US: a traveler can pin the app to day or night, or leave it on local time
// (the OS preference). The choice survives reloads; local time clears it.

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
});

function stubStorage(seed?: Record<string, string>): LampStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed ?? {}));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function renderLamp(storage = stubStorage()) {
  const utils = render(<ThemeLamp storage={storage} />);
  const button = (label: string) => utils.getByRole('button', { name: label });
  return { ...utils, button, storage };
}

describe('ThemeLamp', () => {
  it('offers day, night, and local time, defaulting to local time', () => {
    const { button } = renderLamp();
    expect(button('Day').getAttribute('aria-pressed')).toBe('false');
    expect(button('Night').getAttribute('aria-pressed')).toBe('false');
    expect(button('Local time').getAttribute('aria-pressed')).toBe('true');
  });

  it('pins night: sets the attribute, persists, reflects', () => {
    const { button, storage } = renderLamp();
    fireEvent.click(button('Night'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(storage.map.get('ts-theme')).toBe('dark');
    expect(button('Night').getAttribute('aria-pressed')).toBe('true');
    expect(button('Local time').getAttribute('aria-pressed')).toBe('false');
  });

  it('returning to local time clears attribute and storage', () => {
    const { button, storage } = renderLamp();
    fireEvent.click(button('Day'));
    fireEvent.click(button('Local time'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(storage.map.has('ts-theme')).toBe(false);
    expect(button('Local time').getAttribute('aria-pressed')).toBe('true');
  });

  it('reads a stored choice on mount', () => {
    const { button } = renderLamp(stubStorage({ 'ts-theme': 'light' }));
    expect(button('Day').getAttribute('aria-pressed')).toBe('true');
  });
});
