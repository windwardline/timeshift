// The magic-link email's HTML (US-A2). Pure — lib/auth/email.ts is the Resend
// network shell, and the shell is the part that stays untested and uncovered
// (CLAUDE.md §13). Splitting the body out is what makes the markup assertable,
// the same way lib/rag keeps its pure units beside chunk.ts while embed.ts holds
// the network.
export function magicLinkHtml(url: string): string {
  return `
        <div style="font-family:system-ui,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 12px">Sign in to TimeShift</h2>
          <p>Click the button below to sign in. This link expires in 15 minutes.</p>
          <p><a href="${url}" style="display:inline-block;background:#7c5cff;color:#fff;
             text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in</a></p>
          <p style="color:#667;font-size:13px">If you didn't request this, you can ignore it.</p>
        </div>`;
}
