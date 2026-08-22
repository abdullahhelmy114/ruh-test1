// src/app/library/page.tsx
import { LibraryProvider } from "@/components/library/LibraryProvider";
import { LibraryView } from "@/components/library/LibraryView";
import { T } from "@/components/TranslatedText";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Digital Library | Ruh-Ul-Qudus Academy",
  description: "Access a rich library of Arabic books, PDFs, and learning resources for non-native speakers.",
  alternates: { canonical: "https://ruhulqudus.com/library" },
  openGraph: {
    title: "Digital Library | Ruh-Ul-Qudus Academy",
    description: "Explore our digital library of Arabic books and resources.",
    url: "https://ruhulqudus.com/library",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Digital Library" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Digital Library | Ruh-Ul-Qudus Academy",
    description: "Access Arabic books and learning resources.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

export default function LibraryPage() {
  return (
    <LibraryProvider>
      <div
        className="min-h-[calc(100vh-4rem)] bg-background py-8 md:py-12"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <LibraryView />
        </div>
      </div>
    </LibraryProvider>
  );
}