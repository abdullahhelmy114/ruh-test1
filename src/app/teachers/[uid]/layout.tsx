export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Teachers | Ruh-Ul-Qudus Academy",
  description: "Meet our qualified Arabic and Quran teachers dedicated to helping non-native speakers succeed.",
  alternates: { canonical: "https://ruhulqudus.com/teachers" },
  openGraph: {
    title: "Our Teachers | Ruh-Ul-Qudus Academy",
    description: "Meet our qualified Arabic and Quran teachers.",
    url: "https://ruhulqudus.com/teachers",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light.png", width: 1200, height: 630, alt: "Our Teachers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Our Teachers | Ruh-Ul-Qudus Academy",
    description: "Meet our qualified Arabic and Quran teachers.",
    images: ["https://ruhulqudus.com/light.png"],
  },
};
export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}