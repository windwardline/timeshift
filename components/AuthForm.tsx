'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Something went wrong.');
        return;
      }
      router.push('/');
      router.refresh();
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
          {isRegister ? 'Create account' : 'Welcome back'}
        </h1>
        <p className="lede">
          {isRegister
            ? 'Save your itineraries and get a personalized jetlag plan for each one.'
            : 'Sign in to your trips.'}
        </p>
      </header>

      <form className="card reveal-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
          {isRegister && (
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>At least 8 characters.</span>
          )}
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
        {error && <p className="err">{error}</p>}
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {isRegister ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/register">Create an account</Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
