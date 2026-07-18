import QuranIrabViewer from "@/components/QuranIrabViewer";

export default function AyahPage({ params }: { params: { surah: string; ayah: string } }) {
  return (
    <div className="min-h-screen bg-background py-6">
      <QuranIrabViewer
        initialSurah={parseInt(params.surah)}
        initialAyah={parseInt(params.ayah)}
      />
    </div>
  );
}