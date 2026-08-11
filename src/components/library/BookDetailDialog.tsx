// src/components/library/BookDetailDialog.tsx
"use client";

import { useRouter } from "next/navigation";
import { Book, useLibrary } from "./LibraryProvider";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BookOpen, Lock } from "lucide-react";

interface BookDetailDialogProps {
  book: Book | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe?: (book: Book) => void;
}

export function BookDetailDialog({
  book,
  open,
  onOpenChange,
  onSubscribe,
}: BookDetailDialogProps) {
  const router = useRouter();
  const { hasAccess, isAdmin, categories } = useLibrary();

  if (!book) return null;

  const canRead = isAdmin || hasAccess;

  // استخراج أسماء التصنيفات لهذا الكتاب
  const bookCategoryNames = book.categories
    ?.map((c) => {
      const cat = categories.find((cat) => cat.id === c.id);
      return cat?.name_ar || cat?.name || c.name;
    })
    .join(" · ");

  const handleRead = () => {
    onOpenChange(false);
    router.push(`/library/book/detail?id=${book.id}`);
  };

  const handleSubscribe = () => {
    onOpenChange(false);
    onSubscribe?.(book);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-amber-500/30 sm:max-w-lg">
        <DialogHeader>
          {/* مسار التصنيفات */}
          {bookCategoryNames && (
            <p className="text-gold text-[10px] tracking-[0.3em] uppercase">
              {bookCategoryNames}
            </p>
          )}
          <DialogTitle className="font-display text-3xl leading-tight">
            {book.title}
          </DialogTitle>

          {book.author && (
            <p className="text-gray-500 text-sm mt-1">
              by <span className="text-gray-900 font-medium">{book.author}</span>
            </p>
          )}

          <DialogDescription className="pt-2 text-base leading-relaxed">
            {book.description || (
              <span className="italic text-gray-500">
                <T>No description available</T>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* فاصل ذهبي */}
        <div className="gold-rule my-1 h-px" />

        <div className="flex items-center justify-between gap-4">
          {book.year && (
            <p className="text-xs text-gray-500">
              سنة النشر: {book.year}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 mt-2">
          {canRead ? (
            <Button
              className="bg-amber-100text-amber-700 hover:bg-accent/85 rounded-full w-full"
              onClick={handleRead}
            >
              <BookOpen className="h-4 w-4 ml-2" />
              <T>Begin Reading</T>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-amber-500/30 text-gold hover:bg-amber-500/10 rounded-full w-full"
              onClick={handleSubscribe}
            >
              <Lock className="h-4 w-4 ml-2" />
              <T>Subscribe to Read</T>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}