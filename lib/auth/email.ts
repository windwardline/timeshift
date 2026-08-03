/* v8 ignore file */
// Network boundary for outgoing email (like lib/ai/client.ts): the only module
// that calls Resend. Excluded from coverage and not unit-tested; the API key is
// read server-side only. Uses the Resend REST API directly (no extra SDK).
// The body's markup lives in ./email-template, which is pure and asserted.
import { magicLinkHtml } from './email-template';

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
      html: magicLinkHtml(url),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}
