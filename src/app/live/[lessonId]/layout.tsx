export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Sessions | Ruh-Ul-Qudus Academy",
  description: "Join live Arabic and Quran classes with experienced instructors. Interactive, real-time learning.",
  alternates: { canonical: "https://ruhulqudus.com/live" },
  openGraph: {
    title: "Live Sessions | Ruh-Ul-Qudus Academy",
    description: "Join our live Arabic and Quran classes with expert instructors.",
    url: "https://ruhulqudus.com/live",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Live Sessions" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Live Sessions | Ruh-Ul-Qudus Academy",
    description: "Join our live Arabic and Quran classes.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};
export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}