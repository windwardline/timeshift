// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ThemeLamp } from './ThemeLamp';
import { THEME_KEY } from '../lib/theme/theme';

// US: a traveler can pin the app to day or night, or leave it on local time
// (the OS preference). The choice survives reloads; local time clears it.

afterEach(() => {
  cleanup();
  localStorage.removeItem(THEME_KEY);
  document.documentElement.removeAttribute('data-theme');
});

function renderLamp() {
  const utils = render(<ThemeLamp />);
  const button = (label: string) => utils.getByRole('button', { name: label });
  return { ...utils, button };
}

describe('ThemeLamp', () => {
  it('offers day, night, and local time, defaulting to local time', () => {
    const { button } = renderLamp();
    expect(button('Day').getAttribute('aria-pressed')).toBe('false');
    expect(button('Night').getAttribute('aria-pressed')).toBe('false');
    expect(button('Local time').getAttribute('aria-pressed')).toBe('true');
  });

  it('pins night: sets the attribute, persists, reflects', () => {
    const { button } = renderLamp();
    fireEvent.click(button('Night'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(button('Night').getAttribute('aria-pressed')).toBe('true');
    expect(button('Local time').getAttribute('aria-pressed')).toBe('false');
  });

  it('returning to local time clears attribute and storage', () => {
    const { button } = renderLamp();
    fireEvent.click(button('Day'));
    fireEvent.click(button('Local time'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
    expect(button('Local time').getAttribute('aria-pressed')).toBe('true');
  });

  it('reads a stored choice on mount', () => {
    localStorage.setItem(THEME_KEY, 'light');
    const { button } = renderLamp();
    expect(button('Day').getAttribute('aria-pressed')).toBe('true');
  });
});
