import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { redirect } from 'next/navigation';
import { CommunityTabs } from '@/components/CommunityTabs';

export default async function CommunityPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) redirect('/login');

  let user;
  try {
    user = await getAuth().verifyIdToken(token);
  } catch {
    redirect('/login');
  }

  if (user.role !== 'student') redirect('/');

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">المجتمع</h1>
      <CommunityTabs gender={user.gender as 'male' | 'female'} />
    </main>
  );
}