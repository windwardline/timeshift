import Link from 'next/link';

export const metadata = {
  title: 'Privacy — TimeShift',
  description: 'What TimeShift collects, why, and how to remove it.',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 640 }}>
      <header className="reveal">
        <p className="eyebrow">
          <Link href="/">← TimeShift</Link>
        </p>
        <h1 className="wordmark" style={{ fontSize: 'clamp(32px, 6vw, 52px)' }}>
          Privacy
        </h1>
        <p className="lede">
          TimeShift keeps the minimum it needs to plan your trips. Here is all of it.
        </p>
      </header>

      <section className="card reveal-2" style={{ padding: 24, marginTop: 16 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          What we keep
        </p>
        <p style={{ margin: 0, color: '#d6daf6' }}>
          Your email address, used only to send one-time sign-in links. The trips and
          itineraries you enter. Questions you ask the Jetlag Coach. Nothing else — no ad
          trackers, no analytics profiles, and nothing is sold or shared for marketing.
        </p>
      </section>

      <section className="card reveal-2" style={{ padding: 24, marginTop: 16 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Where it lives
        </p>
        <p style={{ margin: 0, color: '#d6daf6' }}>
          Trip data is stored in a Postgres database hosted by Supabase. Sign-in emails are
          delivered by Resend. The site runs on Vercel. When you ask the Jetlag Coach a
          question, that question and the trip it concerns are sent to Google&rsquo;s
          Gemini API to compose the answer — coach requests are the only data that goes
          anywhere else. Sign-in links are single-use and expire in 15 minutes.
        </p>
      </section>

      <section className="card reveal-2" style={{ padding: 24, marginTop: 16 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>
          Your data, your call
        </p>
        <p style={{ margin: 0, color: '#d6daf6' }}>
          Email <a href="mailto:hello@windwardline.com">hello@windwardline.com</a> to have
          your account and trips deleted; it happens within 30 days. Last updated
          2026-08-04.
        </p>
      </section>
    </main>
  );
}
