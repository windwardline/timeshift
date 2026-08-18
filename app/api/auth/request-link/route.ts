import { NextResponse } from 'next/server';
import { validateEmail } from '@/lib/auth/credentials';
import { createLoginToken } from '@/lib/auth/magic';
import { sendMagicLink } from '@/lib/auth/email';
import { consume } from '@/lib/ratelimit/limit';
import { LIMITS, clientIp } from '@/lib/ratelimit/config';
import { tooManyRequests } from '@/lib/ratelimit/response';

// US-A2 (passwordless): email a one-time sign-in link. The response is generic
// either way so it never reveals whether an account exists.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const valid = validateEmail(body);
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  // The emailed link's host MUST come from trusted server config, never the
  // request — a spoofed Host header would otherwise send victims a link to an
  // attacker's domain and hijack the token (host-header injection).
  const base = process.env.APP_URL;
  if (!base) {
    console.error('[auth] APP_URL is not configured — refusing to send a magic link.');
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
  }

  // Limited twice, because there are two victims (#71). Per caller blunts a
  // scripted loop; per recipient protects the person whose inbox the mail lands
  // in, which is the abuse that actually hurts someone else -- so it is stricter.
  // Both are counted after validation and after the config check, and before any
  // token is minted or mail sent, so a refusal costs neither a row nor a send --
  // and a request this server was never going to honour (preview leaves APP_URL
  // unset by design) costs the caller no allowance and the database no write.
  const ipRate = await consume({
    bucket: 'magicLinkIp', subject: clientIp(request), ...LIMITS.magicLinkIp,
  });
  if (!ipRate.allowed) return tooManyRequests(ipRate.retryAfter);

  const emailRate = await consume({
    bucket: 'magicLinkEmail', subject: valid.email, ...LIMITS.magicLinkEmail,
  });
  if (!emailRate.allowed) return tooManyRequests(emailRate.retryAfter);

  const token = await createLoginToken(valid.email);
  const link = `${base}/api/auth/verify?token=${token}`;

  try {
    await sendMagicLink(valid.email, link);
  } catch (error) {
    console.error('[auth] magic link send failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Could not send the sign-in email — please try again.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
