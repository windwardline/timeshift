import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { HomeZoneForm } from '@/components/HomeZoneForm';

export const dynamic = 'force-dynamic';

// US-A3: the traveler's profile. Sets the home time zone that becomes the
// biological-clock baseline for their trips. Session-gated, like every owned page.
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <main>
      <header className="reveal" style={{ marginBottom: 16 }}>
        <p className="eyebrow">
          <Link href="/">← TimeShift</Link>
        </p>
        <h1 className="wordmark" style={{ fontSize: 34 }}>
          Profile
        </h1>
        <p className="mono" style={{ color: 'var(--muted)', fontSize: 13 }}>
          {user.email}
        </p>
      </header>
      <HomeZoneForm current={user.homeTimeZone} />
    </main>
  );
}
