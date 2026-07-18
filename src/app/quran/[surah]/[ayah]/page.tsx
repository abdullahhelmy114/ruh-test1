import QuranIrabViewer from "@/components/QuranIrabViewer";

export default function AyahPage({ params }: { params: { surah: string; ayah: string } }) {
  const surah = parseInt(params.surah, 10);
  const ayah = parseInt(params.ayah, 10);

  // إذا كانت القيم غير صالحة، نعرض صفحة خطأ
  if (isNaN(surah) || isNaN(ayah) || surah < 1 || surah > 114 || ayah < 1) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">رابط غير صالح</h1>
          <p className="text-muted-foreground">تأكد من رقم السورة والآية.</p>
          <a href="/quran" className="text-primary hover:underline">العودة لفهرس السور</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-6">
      <QuranIrabViewer initialSurah={surah} initialAyah={ayah} />
    </div>
  );
}