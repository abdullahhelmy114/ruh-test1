// src/app/dictionary/layout.tsx
import type { Metadata } from "next";
import { TranslationProvider } from "@/lib/translation";

export const metadata: Metadata = {
  title: "Arabic Dictionary | Ruh-Ul-Qudus Academy",
  description:
    "Explore the Arabic dictionary with plurals, antonyms, and meanings in English and Turkish. Includes Quranic examples with audio.",
  keywords: [
    "Arabic dictionary",
    "Arabic lexicon",
    "Quranic words",
    "Arabic plurals",
    "Arabic antonyms",
    "Learn Arabic vocabulary",
    "Ruh-Ul-Qudus Academy",
  ],
  alternates: {
    canonical: "https://ruhulqudus.com/dictionary",
  },
  openGraph: {
    title: "Arabic Dictionary | Ruh-Ul-Qudus Academy",
    description:
      "Interactive Arabic dictionary with Quranic examples, audio, and translations.",
    url: "https://ruhulqudus.com/dictionary",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [
      {
        url: "https://ruhulqudus.com/light.png",
        width: 1200,
        height: 630,
        alt: "Ruh-Ul-Qudus Academy – Arabic Dictionary",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arabic Dictionary | Ruh-Ul-Qudus Academy",
    description:
      "Interactive Arabic dictionary with Quranic examples, audio, and translations.",
    images: ["https://ruhulqudus.com/light.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function DictionaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TranslationProvider>{children}</TranslationProvider>;
}