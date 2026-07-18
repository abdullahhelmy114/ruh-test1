import Link from "next/link";

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
          فهرس سور القرآن الكريم
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {surahs.map((surah) => (
            <Link
              key={surah.number}
              href={`/quran/${surah.number}/1`}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:bg-primary/5 transition"
            >
              <div className="shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                {surah.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-foreground truncate">
                    {surah.englishName}
                  </p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {surah.numberOfAyahs} آيات
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate font-arabic">
                  {surah.name}
                </p>
                <p className="text-xs text-muted-foreground/60 truncate">
                  {surah.englishNameTranslation}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}