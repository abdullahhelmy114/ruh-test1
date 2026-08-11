// src/components/library/BookCard.tsx
"use client";

import { useMemo } from "react";
import { Book, useLibrary } from "./LibraryProvider";
import { BookOpen } from "lucide-react";
import { T } from "@/components/TranslatedText";

// ---------- لوحة الألوان للغلاف الافتراضي ----------
const CATEGORY_COLORS: Record<string, string> = {
  tazkiya: "linear-gradient(135deg, #7B1F2B 0%, rgba(123,31,43,0.8) 60%, #0B1D3A 100%)",
  hadith: "linear-gradient(135deg, #1E3A5F 0%, rgba(30,58,95,0.8) 60%, #0B1D3A 100%)",
  tafsir: "linear-gradient(135deg, #3D2817 0%, rgba(61,40,23,0.8) 60%, #0B1D3A 100%)",
  seerah: "linear-gradient(135deg, #8B5A2B 0%, rgba(139,90,43,0.8) 60%, #0B1D3A 100%)",
  nahw: "linear-gradient(135deg, #6B3410 0%, rgba(107,52,16,0.8) 60%, #0B1D3A 100%)",
  adab: "linear-gradient(135deg, #7A3B2E 0%, rgba(122,59,46,0.8) 60%, #0B1D3A 100%)",
  aqeedah: "linear-gradient(135deg, #3A3A5E 0%, rgba(58,58,94,0.8) 60%, #0B1D3A 100%)",
  usool: "linear-gradient(135deg, #5A4632 0%, rgba(90,70,50,0.8) 60%, #0B1D3A 100%)",
  fiqh: "linear-gradient(135deg, #2C3E50 0%, rgba(44,62,80,0.8) 60%, #0B1D3A 100%)",
  history: "linear-gradient(135deg, #6D4C1E 0%, rgba(109,76,30,0.8) 60%, #0B1D3A 100%)",
  tasawwuf: "linear-gradient(135deg, #4B2D4A 0%, rgba(75,45,74,0.8) 60%, #0B1D3A 100%)",
  default: "linear-gradient(135deg, #4A5D3A 0%, rgba(74,93,58,0.8) 60%, #0B1D3A 100%)",
};

function getCategoryColor(category?: string): string {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
}

// ---------- المكون ----------
interface BookCardProps {
  book: Book;
  onClick?: () => void;
}

export function BookCard({ book, onClick }: BookCardProps) {
  const { hasAccess, isAdmin } = useLibrary();

  const gradientStyle = useMemo(
    () => getCategoryColor(book.category),
    [book.category]
  );

  const canRead = isAdmin || hasAccess;

  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-right shadow-md transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* الغلاف */}
      <div
        className="relative aspect-[3/4] w-full overflow-hidden"
        style={{
          background: book.cover_url
            ? `url(${book.cover_url}) center/cover`
            : gradientStyle,
        }}
      >
        {!book.cover_url && (
          <>
            <div className="absolute inset-x-4 top-4 text-[10px] uppercase tracking-widest text-[#FDFBF7]/70">
              {book.category || "كتاب"}
            </div>
            <div className="absolute inset-x-4 bottom-4 text-[#FDFBF7]">
              <div className="font-serif text-lg leading-tight">
                {book.title}
              </div>
              {book.author && (
                <div className="mt-1 text-xs opacity-80">{book.author}</div>
              )}
            </div>
            <div className="absolute right-0 top-0 h-full w-1.5 bg-foreground/30" />
          </>
        )}
      </div>

      {/* شريط المعلومات السفلي */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-[11px] text-muted-foreground">
          {book.year || ""}
        </span>
        {canRead ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors group-hover:text-primary/80">
            <BookOpen className="h-3.5 w-3.5" /> <T>Read</T>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" /> <T>Preview</T>
          </span>
        )}
      </div>
    </button>
  );
}