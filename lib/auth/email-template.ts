// The magic-link email's HTML (US-A2). Pure — lib/auth/email.ts is the Resend
// network shell, and the shell is the part that stays untested and uncovered
// (CLAUDE.md §13). Splitting the body out is what makes the markup assertable,
// the same way lib/rag keeps its pure units beside chunk.ts while embed.ts holds
// the network.
//
// Dark-mode hardened per the standing magic-link standard (2026-08-02). Clients
// that auto-invert recolor a message that hasn't declared itself, so: the scheme
// is stated in the head AND on the root wrapper, the wrapper and the button
// carry bgcolor attributes for engines that drop CSS backgrounds, and every text
// color is named. Nothing relies on a client default. The previous body left
// `<h2>` and the paragraph uncolored and set a #667 footer, which measured
// ~3.1:1 against an inverted background.
//
// This sender hands Resend the whole `html` field, so it owns the entire
// document — which is why the meta declarations belong here. Levelflow's
// equivalent is a bare fragment because GoTrue owns that document.
const ACCENT = '#7c5cff';

export function magicLinkHtml(url: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="color-scheme:light;background-color:#ffffff">
      <tr><td style="font-family:system-ui,sans-serif;line-height:1.5;color:#111111">
        <h2 style="margin:0 0 12px;color:#111111">Sign in to TimeShift</h2>
        <p style="color:#111111">Click the button below to sign in. This link expires in 15 minutes.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="${ACCENT}" style="border-radius:8px"><a href="${url}" style="display:inline-block;background-color:${ACCENT};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in</a></td>
        </tr></table>
        <p style="color:#555555;font-size:13px">If you didn't request this, you can ignore it.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
