/** Theme control: day / night / local time (= the OS preference).
 *  Local time is modeled as the absence of a stored choice, so the
 *  CSS media query stays the single source of truth for "system". */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_KEY = 'ts-theme';

type AttrTarget = Pick<Element, 'setAttribute' | 'removeAttribute'>;
type KeyStore = {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function normalizeStored(value: string | null): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return systemDark ? 'dark' : 'light';
  return choice;
}

export function applyChoice(root: AttrTarget, storage: KeyStore, choice: ThemeChoice): void {
  if (choice === 'system') {
    root.removeAttribute('data-theme');
    storage.removeItem(THEME_KEY);
    return;
  }
  root.setAttribute('data-theme', choice);
  storage.setItem(THEME_KEY, choice);
}
