import QuranIrabViewer from "@/components/QuranIrabViewer";

export default function AyahPage({ params }: { params: { surah: string; ayah: string } }) {
  const surah = parseInt(params.surah, 10);
  const ayah = parseInt(params.ayah, 10);

  return (
    <div className="min-h-screen bg-background py-6">
      <QuranIrabViewer initialSurah={surah} initialAyah={ayah} />
    </div>
  );
}