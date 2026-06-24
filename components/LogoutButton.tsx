'use client';

import { useRouter } from 'next/navigation';

// Just the log-out action. The email + profile link live next to it in the page
// header so the whole account row reads: email · Profile · Log out.
export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={logout}>
      Log out
    </button>
  );
}
