"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  BookOpen,
  Box,
  Grid3X3,
  Check,
} from "lucide-react";

// ---------- أنواع ----------
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  category?: string;
  year?: string;
  created_at: string;
}

// ---------- لوحة الألوان للبطاقات ----------
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

function getCategoryArabicName(category: string): string {
  const map: Record<string, string> = {
    tazkiya: "تزكية",
    hadith: "حديث",
    tafsir: "تفسير",
    seerah: "سيرة",
    nahw: "نحو",
    adab: "أدب",
    aqeedah: "عقيدة",
    usool: "أصول",
    fiqh: "فقه",
    history: "تاريخ",
    tasawwuf: "تصوف",
  };
  return map[category] || category;
}

// ---------- الصفحة الرئيسية ----------
export default function LibraryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState<Book[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "3d">("grid");

  useEffect(() => {
    if (!user) {
      setCheckingAccess(false);
      return;
    }

    authFetch("/api/library/access")
      .then((r) => r.json())
      .then((data) => {
        setHasAccess(data.hasAccess);
        setIsAdmin(data.isAdmin || false);
        if (data.hasAccess) {
          return fetch("/api/library/books").then((r) => r.json());
        }
        return { books: [] };
      })
      .then((data) => {
        if (data?.books) setBooks(data.books);
      })
      .finally(() => setCheckingAccess(false));
  }, [user]);

  const filteredBooks = useMemo(() => {
    let result = books;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          (b.author && b.author.toLowerCase().includes(query))
      );
    }
    if (selectedCategory !== "all") {
      result = result.filter((b) => b.category === selectedCategory);
    }
    return result;
  }, [books, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    books.forEach((b) => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats);
  }, [books]);

  const handleBookClick = useCallback(
    (book: Book) => {
      if (isAdmin || hasAccess) {
        router.push(`/library/book/${book.id}`);
      } else {
        setSelectedBook(book);
        setShowSubscribeDialog(true);
      }
    },
    [isAdmin, hasAccess, router]
  );

  const handleMockPurchase = async (plan: "monthly" | "lifetime") => {
    setSubscribing(true);
    try {
      const res = await authFetch("/api/library/mock-purchase", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.success) {
        setHasAccess(true);
        setShowSubscribeDialog(false);
        if (selectedBook) {
          router.push(`/library/book/${selectedBook.id}`);
        }
      } else {
        alert(data.error || "Purchase failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubscribing(false);
    }
  };

  if (isLoading || checkingAccess) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">
            <T>Loading</T>
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background text-center gap-6 px-4">
        <h1 className="text-4xl font-bold text-foreground">
          <T>Ruhulqudus Library</T>
        </h1>
        <p className="text-lg text-muted-foreground">
          <T>Login Required</T>
        </p>
        <Link href="/login">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-lg">
            <T>Login</T>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background" dir="rtl">
      <div className="border-b border-border bg-[var(--gradient-hero)] text-[#FDFBF7]">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] opacity-70">Ruhulqudus</div>
              <h1 className="mt-2 font-serif text-4xl md:text-5xl">
                <T>Ruhulqudus Library</T>
              </h1>
              <p className="mt-2 max-w-xl text-sm opacity-80">
                <T>Elegant shelves housing the most important Islamic books — browse in three dimensions, and open the book to flip through its pages as if you were in an old library.</T>
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                <Input
                  placeholder="ابحث عن كتاب أو مؤلف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-[#FDFBF7]/20 bg-[#FDFBF7]/10 pl-4 pr-10 py-2.5 text-sm placeholder:text-[#FDFBF7]/50 focus:border-[#FDFBF7]/50 focus:outline-none sm:w-80 text-[#FDFBF7]"
                />
              </div>
              <div className="flex rounded-full border border-[#FDFBF7]/20 bg-[#FDFBF7]/10 p-1">
                <button
                  onClick={() => setViewMode("3d")}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition ${
                    viewMode === "3d" ? "bg-[#FDFBF7] text-[#0B1D3A]" : ""
                  }`}
                >
                  <Box className="h-3.5 w-3.5" /> 3D
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition ${
                    viewMode === "grid" ? "bg-[#FDFBF7] text-[#0B1D3A]" : ""
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" /> <T>Grid</T>
                </button>
              </div>
            </div>
          </div>
          {hasAccess && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#FDFBF7]/15 bg-[#FDFBF7]/5 px-4 py-3 text-sm">
              <Check className="h-4 w-4 text-emerald-300" />
              <span><T>Subscription Active</T></span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {categories.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="rounded-full"
            >
              <T>All Categories</T>
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full"
              >
                {getCategoryArabicName(cat)}
              </Button>
            ))}
          </div>
        )}

        {filteredBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <BookOpen className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">
              <T>No Books Available Yet</T>
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredBooks.map((book) => (
              <button
                key={book.id}
                onClick={() => handleBookClick(book)}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-right shadow-sm transition-all hover:-translate-y-1 hover:shadow-elegant"
              >
                <div
                  className="relative aspect-[3/4] w-full overflow-hidden"
                  style={{
                    background: book.cover_url
                      ? `url(${book.cover_url}) center/cover`
                      : getCategoryColor(book.category),
                  }}
                >
                  {!book.cover_url && (
                    <>
                      <div className="absolute inset-x-4 top-4 text-[10px] uppercase tracking-widest text-[#FDFBF7]/70">
                        {getCategoryArabicName(book.category || "default")}
                      </div>
                      <div className="absolute inset-x-4 bottom-4 text-[#FDFBF7]">
                        <div className="font-serif text-lg leading-tight">{book.title}</div>
                        {book.author && (
                          <div className="mt-1 text-xs opacity-80">{book.author}</div>
                        )}
                      </div>
                      <div className="absolute right-0 top-0 h-full w-1.5 bg-black/30" />
                    </>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-[11px] text-muted-foreground">{book.year || ""}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BookOpen className="h-3.5 w-3.5" /> <T>Read</T>
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <p><T>View 3D Coming Soon</T></p>
          </div>
        )}
      </div>

      <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl"><T>Subscribe to Library</T></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-muted-foreground"><T>Subscribe Description</T></p>
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-primary/30 hover:bg-primary/10"
                onClick={() => handleMockPurchase("monthly")}
                disabled={subscribing}
              >
                <span className="text-lg font-bold">$9.99</span>
                <span className="text-xs text-muted-foreground"><T>Monthly</T></span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2 border-accent/30 hover:bg-accent/10"
                onClick={() => handleMockPurchase("lifetime")}
                disabled={subscribing}
              >
                <span className="text-lg font-bold">$49.99</span>
                <span className="text-xs text-muted-foreground"><T>Lifetime</T></span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSubscribeDialog(false)}>
              <T>Cancel</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}