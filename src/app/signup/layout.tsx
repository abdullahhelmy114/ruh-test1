export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Ruh-Ul-Qudus Academy",
  description: "Create your free account and start learning Arabic and Quran with Ruh-Ul-Qudus Academy.",
  alternates: { canonical: "https://ruhulqudus.com/signup" },
  openGraph: {
    title: "Sign Up | Ruh-Ul-Qudus Academy",
    description: "Create your free account and start learning.",
    url: "https://ruhulqudus.com/signup",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Sign Up" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign Up | Ruh-Ul-Qudus Academy",
    description: "Create your free account and start learning.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}