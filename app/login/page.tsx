import { MagicLinkForm } from '@/components/MagicLinkForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const notice =
    error === 'expired' ? 'That sign-in link was invalid or expired — request a new one.' : undefined;
  return <MagicLinkForm notice={notice} />;
}
