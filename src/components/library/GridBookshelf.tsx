// src/components/library/GridBookshelf.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { T } from "@/components/TranslatedText";
import { BookCard } from "./BookCard";
import { useLibrary, type Book } from "./LibraryProvider";

interface GridBookshelfProps {
  onBookClick?: (book: Book) => void;
}

export function GridBookshelf({ onBookClick }: GridBookshelfProps) {
  const { books, categories, loading } = useLibrary();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // استخراج التصنيفات الرئيسية فقط (parent_id = null) لاستخدامها كأزرار تصفية
  const rootCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  // تصفية الكتب حسب البحث والتصنيف
  const filteredBooks = useMemo(() => {
    let result = books;

    // بحث نصي
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          (b.author && b.author.toLowerCase().includes(query))
      );
    }

    // تصفية حسب التصنيف
    if (selectedCategory !== "all") {
      result = result.filter((b) =>
        b.categories?.some((c) => c.slug === selectedCategory)
      );
    }

    return result;
  }, [books, searchQuery, selectedCategory]);

  // عرض التحميل
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p><T>Loading</T></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* شريط البحث وأزرار التصنيفات */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث عن كتاب أو مؤلف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-input bg-background pl-4 pr-10 py-2 text-sm placeholder:text-muted-foreground focus:border-primary"
            dir="rtl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
            className="rounded-full"
          >
            <T>All Categories</T>
          </Button>
          {rootCategories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.slug ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.slug)}
              className="rounded-full"
            >
              {cat.name_ar || cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* الشبكة */}
      {filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpen className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg"><T>No Books Available Yet</T></p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => onBookClick?.(book)}
            />
          ))}
        </div>
      )}
    </div>
  );
}