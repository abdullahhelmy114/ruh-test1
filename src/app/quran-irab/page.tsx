import Link from "next/link";

export default function QuranSurahsPage() {
  const surahs = Array.from({ length: 114 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background py-10" dir="rtl">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-foreground text-center mb-8">
          فهرس سور القرآن الكريم
        </h1>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {surahs.map((num) => (
            <Link
              key={num}
              href={`/quran/${num}`}
              className="bg-card border border-border rounded-xl p-3 text-center text-foreground hover:bg-primary/10 transition"
            >
              <span className="text-lg font-semibold">{num}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}