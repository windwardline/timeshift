'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export function MagicLinkForm({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Something went wrong.');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 460 }}>
      <header className="reveal">
        <p className="eyebrow">
          <Link href="/">← TimeShift</Link>
        </p>
        <h1 className="wordmark" style={{ fontSize: 'clamp(32px, 6vw, 52px)' }}>
          Sign in
        </h1>
        <p className="lede">No password — we&rsquo;ll email you a secure, one-time sign-in link.</p>
      </header>

      {sent ? (
        <section className="card reveal-2" style={{ padding: 24 }}>
          <p className="eyebrow" style={{ color: 'var(--aurora)', marginBottom: 8 }}>
            Check your email
          </p>
          <p style={{ margin: 0, color: '#d6daf6' }}>
            We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
          </p>
        </section>
      ) : (
        <form className="card reveal-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={submit}>
          {notice && <p className="err">{notice}</p>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      )}
    </main>
  );
}
