// src/components/library/Scene3D.tsx
"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLibrary, type Book } from "./LibraryProvider";
import type { ShelfRow } from "./GlassLibraryScene";
import { T } from "@/components/TranslatedText";

// استيراد ديناميكي لمكون Three.js مع تعطيل الـ SSR
const GlassLibraryScene = dynamic(() => import("./GlassLibraryScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">
          <T>Opening 3D Library…</T>
        </p>
      </div>
    </div>
  ),
});

// ── إعدادات ──────────────────────────────────────
const BOOKS_PER_SHELF = 10;
const SHELVES_PER_PAGE = 6;

interface Scene3DProps {
  onBookClick?: (book: Book) => void;
}

export default function Scene3D({ onBookClick }: Scene3DProps) {
  const { books, categories, loading } = useLibrary();
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState(0);

  // بناء صفوف الأرفف من الكتب والتصنيفات
  const rows = useMemo(() => {
    if (loading || books.length === 0) return [];

    // تجميع الكتب حسب التصنيف (نستخدم category slug أو category name)
    const grouped: Record<string, { label: string; labelAr: string; books: Book[] }> = {};

    books.forEach((book) => {
      // نأخذ التصنيف الأول (أو نتركه فارغًا)
      const cat = book.categories?.[0];
      const key = cat?.slug || "uncategorized";
      if (!grouped[key]) {
        const category = categories.find((c) => c.slug === key);
        grouped[key] = {
          label: category?.name || key,
          labelAr: category?.name_ar || key,
          books: [],
        };
      }
      grouped[key].books.push(book);
    });

    // تحويل المجموعات إلى صفوف أرفف (كل رف يحتوي على حتى BOOKS_PER_SHELF كتب)
    const allRows: ShelfRow[] = [];
    Object.values(grouped).forEach((group) => {
      for (let i = 0; i < group.books.length; i += BOOKS_PER_SHELF) {
        allRows.push({
          label: group.label,
          labelAr: group.labelAr,
          books: group.books.slice(i, i + BOOKS_PER_SHELF),
        });
      }
    });

    return allRows;
  }, [books, categories, loading]);

  const pages = Math.max(1, Math.ceil(rows.length / SHELVES_PER_PAGE));
  const current = Math.min(page, pages - 1);
  const visibleRows = rows.slice(
    current * SHELVES_PER_PAGE,
    (current + 1) * SHELVES_PER_PAGE
  );

  const go = (delta: number) => {
    setDirection(delta);
    setPage((p) => Math.min(pages - 1, Math.max(0, p + delta)));
  };

  if (loading || rows.length === 0) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
        <div className="text-center">
          <BookOpen className="mx-auto h-12 w-12 opacity-30" />
          <p className="mt-4 text-lg">
            <T>No Books to Display in 3D</T>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-2xl border border-border bg-background">
      {/* أزرار التنقل */}
      {current > 0 && (
        <button
          onClick={() => go(-1)}
          aria-label="Previous shelves"
          className="glass-panel absolute left-4 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-foreground"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {current < pages - 1 && (
        <button
          onClick={() => go(1)}
          aria-label="Next shelves"
          className="glass-panel absolute right-4 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full text-foreground"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* المشهد الثلاثي الأبعاد */}
      <GlassLibraryScene
        rows={visibleRows}
        direction={direction}
        theme="dark" // يمكن ربطه بـ useTheme لاحقًا
        onOpen={onBookClick || (() => {})}
      />

      {/* مؤشر الصفحات */}
      {pages > 1 && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5">
          {Array.from({ length: pages }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-6 bg-accent" : "w-1.5 bg-gold/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// استيراد إضافي للأيقونة
import { BookOpen } from "lucide-react";