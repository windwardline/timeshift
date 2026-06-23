/* v8 ignore file */
// Network boundary for outgoing email (like lib/ai/client.ts): the only module
// that calls Resend. Excluded from coverage and not unit-tested; the API key is
// read server-side only. Uses the Resend REST API directly (no extra SDK).
const RESEND_URL = 'https://api.resend.com/emails';

export async function sendMagicLink(email: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAGIC_LINK_FROM ?? 'TimeShift <login@windwardline.com>';
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your TimeShift sign-in link',
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.5">
          <h2 style="margin:0 0 12px">Sign in to TimeShift</h2>
          <p>Click the button below to sign in. This link expires in 15 minutes.</p>
          <p><a href="${url}" style="display:inline-block;background:#7c5cff;color:#fff;
             text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Sign in</a></p>
          <p style="color:#667;font-size:13px">If you didn't request this, you can ignore it.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
