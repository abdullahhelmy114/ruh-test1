export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teacher Verification | Ruh-Ul-Qudus Academy",
  description: "Apply for teacher verification at Ruh-Ul-Qudus Academy and join our team of instructors.",
  alternates: { canonical: "https://ruhulqudus.com/verify-teacher" },
  openGraph: {
    title: "Teacher Verification | Ruh-Ul-Qudus Academy",
    description: "Apply for teacher verification and join our team.",
    url: "https://ruhulqudus.com/verify-teacher",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Teacher Verification" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teacher Verification | Ruh-Ul-Qudus Academy",
    description: "Apply for teacher verification and join our team.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}