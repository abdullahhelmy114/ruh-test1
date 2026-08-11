// src/app/library/page.tsx
import { LibraryProvider } from "@/components/library/LibraryProvider";
import { LibraryView } from "@/components/library/LibraryView";
import { T } from "@/components/TranslatedText";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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