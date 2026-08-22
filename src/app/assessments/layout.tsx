export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assessments | Ruh-Ul-Qudus Academy",
  description: "Test your Arabic level and track your progress with our comprehensive assessments.",
  alternates: { canonical: "https://ruhulqudus.com/assessments" },
  openGraph: {
    title: "Assessments | Ruh-Ul-Qudus Academy",
    description: "Test your Arabic level and track your progress.",
    url: "https://ruhulqudus.com/assessments",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Assessments" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Assessments | Ruh-Ul-Qudus Academy",
    description: "Test your Arabic level and track your progress.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};
export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}