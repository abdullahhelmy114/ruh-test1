export const runtime = 'edge';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Ruh-Ul-Qudus Academy",
  description: "Login to your Ruh-Ul-Qudus Academy account to continue your Arabic and Quran learning journey.",
  alternates: { canonical: "https://ruhulqudus.com/login" },
  openGraph: {
    title: "Login | Ruh-Ul-Qudus Academy",
    description: "Login to your account and continue learning.",
    url: "https://ruhulqudus.com/login",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Login" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Login | Ruh-Ul-Qudus Academy",
    description: "Login to your account and continue learning.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function LiveLessonLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}