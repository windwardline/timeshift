import { describe, it, expect } from 'vitest';
import { magicLinkHtml } from './email-template';

// The magic-link email must render identically in dark-mode mail clients
// (standing magic-link standard, "Dark mode (hardened 2026-08-02)"). Clients
// that auto-invert do so unguided unless the message declares its scheme, backs
// its surfaces with bgcolor attributes, and names every text color. No color may
// rely on a client default.
//
// TimeShift's sender hands Resend the entire `html` field, so it owns the whole
// document — which is why the meta declarations belong here and not only on the
// wrapper. Levelflow's equivalent is a fragment because GoTrue owns its document.

const html = magicLinkHtml('https://timeshift.windwardline.com/api/auth/verify?token=abc123');
const ACCENT = '#7c5cff';

describe('magicLinkHtml — copy and casing', () => {
  it('keeps the standard copy, casing, and the 15-minute line', () => {
    expect(html).toContain('>Sign in to TimeShift</h2>');
    expect(html).toContain('Click the button below to sign in. This link expires in 15 minutes.');
    expect(html).toContain('>Sign in</a>');
    expect(html).toContain("If you didn't request this, you can ignore it.");
  });

  it('links the url it was given', () => {
    expect(html).toContain('href="https://timeshift.windwardline.com/api/auth/verify?token=abc123"');
  });
});

describe('magicLinkHtml — dark-mode hardening', () => {
  it('declares a light scheme in the head, since this sender owns the document', () => {
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain('<meta name="supported-color-schemes" content="light">');
  });

  it('declares the scheme on the root wrapper too', () => {
    expect(html).toContain('color-scheme:light');
  });

  it('backs the wrapper and the button with bgcolor fallbacks', () => {
    expect(html).toContain('bgcolor="#ffffff"');
    expect(html).toContain(`bgcolor="${ACCENT}"`);
  });

  it('carries the TimeShift accent on the button, not another app\'s', () => {
    expect(html).toContain(`background-color:${ACCENT};color:#ffffff`);
    expect(html).not.toContain('#2244FF'); // Levelflow's blue
    expect(html).not.toContain('#17594e'); // pathfinder's green
  });

  it('names every text color explicitly', () => {
    expect(html).toContain('color:#111111'); // body
    expect(html).toContain('color:#555555'); // footer
  });

  it('leaves no color to a client default', () => {
    // The shorthand `background:` and the 3-digit `#fff`/`#667` are what the
    // unhardened body used; #667 on white measured ~3.1:1 once inverted.
    expect(html).not.toMatch(/background:#/);
    expect(html).not.toMatch(/#fff\b/);
    expect(html).not.toMatch(/#667\b/);
    // Every element that renders text must say what color it is.
    const styledTextTags = html.match(/<(h2|p)\b[^>]*>/g) ?? [];
    expect(styledTextTags.length).toBeGreaterThan(0);
    for (const tag of styledTextTags) {
      expect(tag, `${tag} must set an explicit color`).toMatch(/color:#[0-9a-f]{6}/i);
    }
  });
});
