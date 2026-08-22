import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { T } from "@/components/TranslatedText";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Quran Learning | Ruh-Ul-Qudus Academy",
  description: "Learn Quran recitation, tajweed, and understanding with expert teachers and interactive tools.",
  alternates: { canonical: "https://ruhulqudus.com/quran" },
  openGraph: {
    title: "Quran Learning | Ruh-Ul-Qudus Academy",
    description: "Master Quran recitation and tajweed with our expert-led programs.",
    url: "https://ruhulqudus.com/quran",
    siteName: "Ruh-Ul-Qudus Academy",
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_SA", "tr_TR"],
    images: [{ url: "https://ruhulqudus.com/light1.png", width: 1200, height: 630, alt: "Quran Learning" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quran Learning | Ruh-Ul-Qudus Academy",
    description: "Learn Quran recitation and tajweed online.",
    images: ["https://ruhulqudus.com/light1.png"],
  },
};

interface SurahInfo {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

async function fetchSurahs(): Promise<SurahInfo[]> {
  const res = await fetch("https://api.alquran.cloud/v1/surah");
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}

export default async function QuranSurahsPage() {
  const surahs = await fetchSurahs();

  return (
    <div className="min-h-screen bg-background py-10" dir="rtl">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-foreground text-center mb-8">
          <T>Quran Surahs Index</T>
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {surahs.map((surah) => (
            <Link
              key={surah.number}
              href={`/quran/${surah.number}/1`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-4 hover:bg-primary/5 transition group"
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {surah.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {surah.englishName}
                </p>
                <p className="text-sm text-muted-foreground truncate font-arabic">
                  {surah.name}
                </p>
                <p className="text-xs text-muted-foreground/60 truncate">
                  {surah.englishNameTranslation} · {surah.numberOfAyahs} آيات
                </p>
              </div>
              <ChevronLeft className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}