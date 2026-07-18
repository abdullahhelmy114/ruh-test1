import QuranIrabViewer from "@/components/QuranIrabViewer";

export default function QuranIrabPage() {
  return (
    <div className="min-h-screen bg-background py-8">
      <QuranIrabViewer initialSurah={2} initialAyah={7} />
    </div>
  );
}