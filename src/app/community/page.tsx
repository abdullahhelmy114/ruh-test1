import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { communityGenderOf } from '@/lib/community-auth';
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
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Community" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Community | Ruh-Ul-Qudus Academy",
    description: "Join our community of Arabic learners and teachers.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};

// The community is for students, in the space of the gender on their profile.
// Identity comes from the central session (the __session cookie); this page
// used to read a "session" cookie the application never sets and role and
// gender claims it never issues, so every student was sent to sign in.
export default async function CommunityPage() {
  const cookieHeader = (await cookies()).toString();
  const user = await getSession(new Request('http://localhost/community', { headers: { cookie: cookieHeader } }));
  if (!user) redirect('/login');
  if (user.role !== 'student') redirect('/');

  const gender = await communityGenderOf(user.uid);
  if (!gender) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">المجتمع</h1>
        <p className="text-muted-foreground">أضف الجنس إلى ملفك الشخصي للانضمام إلى المجتمع.</p>
        <Link href="/profile/student" className="mt-4 inline-block font-semibold underline">
          الملف الشخصي
        </Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">المجتمع</h1>
      <CommunityTabs gender={gender} />
    </main>
  );
}
