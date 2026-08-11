// src/components/library/LibraryView.tsx
"use client";

import { useState, useCallback, Suspense, lazy } from "react";
import { Box, Grid3X3, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { T } from "@/components/TranslatedText";
import { GridBookshelf } from "./GridBookshelf";
import { BookDetailDialog } from "./BookDetailDialog";
import { useLibrary, type Book } from "./LibraryProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/authFetch";
import { useRouter } from "next/navigation";

// استيراد ديناميكي للمشهد الثلاثي الأبعاد (لن يتم تحميله إلا عند الحاجة)
const Scene3D = lazy(() => import("./Scene3D"));

export function LibraryView() {
  const { books, categories, hasAccess, isAdmin, loading } = useLibrary();
  const [viewMode, setViewMode] = useState<"grid" | "3d">("grid");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const router = useRouter();

  // فتح تفاصيل الكتاب
  const handleBookClick = useCallback(
    (book: Book) => {
      if (isAdmin || hasAccess) {
        // يمكنه القراءة مباشرة
        router.push(`/library/book/detail?id=${book.id}`);
      } else {
        setSelectedBook(book);
        setDetailOpen(true);
      }
    },
    [isAdmin, hasAccess, router]
  );

  // فتح حوار الاشتراك من نافذة التفاصيل
  const handleSubscribe = useCallback((book: Book) => {
    setSelectedBook(book);
    setDetailOpen(false);
    setShowSubscribeDialog(true);
  }, []);

  const handleMockPurchase = async (plan: "monthly" | "lifetime") => {
    setSubscribing(true);
    try {
      const res = await authFetch("/api/library/mock-purchase", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.success) {
        // تحديث الحالة في المزوّد (يمكن استدعاء refresh)
        window.location.reload(); // حل مؤقت لحين دمج refresh من LibraryProvider
      } else {
        alert(data.error || "Purchase failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-gray-500"><T>Loading</T></p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* شريط العنوان والتحكم */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-serif text-gray-900">
            <T>Ruhulqudus Library</T>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            <T>Elegant shelves housing the most important Islamic books.</T>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* زر التبديل Grid / 3D */}
          <div className="flex rounded-full border border-gray-200 bg-muted p-1">
            <button
              onClick={() => setViewMode("3d")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                viewMode === "3d"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Box className="h-3.5 w-3.5" /> 3D
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition ${
                viewMode === "grid"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Grid3X3 className="h-3.5 w-3.5" /> <T>Grid</T>
            </button>
          </div>
        </div>
      </div>

      {/* شريط حالة الاشتراك */}
      {hasAccess && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4" />
          <span><T>Subscription Active</T></span>
        </div>
      )}

      {/* عرض المحتوى حسب وضع العرض */}
      {viewMode === "grid" ? (
        <GridBookshelf onBookClick={handleBookClick} />
      ) : (
        <Suspense
          fallback={
            <div className="flex h-[70vh] items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p><T>Opening 3D Library…</T></p>
              </div>
            </div>
          }
        >
          <Scene3D onBookClick={handleBookClick} />
        </Suspense>
      )}

      {/* حوار تفاصيل الكتاب */}
      <BookDetailDialog
        book={selectedBook}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSubscribe={handleSubscribe}
      />

      {/* حوار الاشتراك (من النظام القديم، مع تحسين الشكل) */}
      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="bg-card border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-xl">
              <T>Subscribe to Library</T>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-gray-500">
              <T>Subscribe Description</T>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-primary/30 hover:bg-emerald-500/10"
                onClick={() => handleMockPurchase("monthly")}
                disabled={subscribing}
              >
                <span className="text-lg font-bold">$9.99</span>
                <span className="text-xs text-gray-500">
                  <T>Monthly</T>
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-accent/30 hover:bg-accent/10"
                onClick={() => handleMockPurchase("lifetime")}
                disabled={subscribing}
              >
                <span className="text-lg font-bold">$49.99</span>
                <span className="text-xs text-gray-500">
                  <T>Lifetime</T>
                </span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowSubscribeDialog(false)}
            >
              <T>Cancel</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}