'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton({ email }: { email: string }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginBottom: 8 }}>
      <span className="mono" style={{ color: 'var(--muted)', fontSize: 12.5 }}>
        {email}
      </span>
      <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={logout}>
        Log out
      </button>
    </div>
  );
}
