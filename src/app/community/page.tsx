import { cookies } from 'next/headers';
import { getAuth } from 'firebase-admin/auth';
import { redirect } from 'next/navigation';
import { CommunityTabs } from '@/components/CommunityTabs';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community | Ruh-Ul-Qudus Academy",
  description: "Join a supportive community of Arabic learners and teachers. Ask questions, share progress, and grow together.",
  alternates: { canonical: "https://ruhulqudus.com/community" },
  openGraph: {
    title: "Community | Ruh-Ul-Qudus Academy",
    description: "Join our community of Arabic learners and teachers.",
    url: "https://ruhulqudus.com/community",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Community" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community | Ruh-Ul-Qudus Academy",
    description: "Join our community of Arabic learners and teachers.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

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