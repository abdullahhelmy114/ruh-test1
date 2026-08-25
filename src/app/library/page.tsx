"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Search, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_file_id?: string | null;
  cover_url?: string | null;
  access_type: "free" | "partial" | "paid" | "course" | "bundle" | "subscription";
  price: number;
  is_published: boolean;
  categories?: { id: string; name: string; slug: string; name_ar?: string }[];
}

interface Category {
  id: string;
  name: string;
  name_ar?: string;
  slug: string;
}

export default function PublicLibraryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Fetch books and categories
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const [booksRes, categoriesRes] = await Promise.all([
          authFetch("/api/library/books"),
          authFetch("/api/library/categories"),
        ]);

        if (booksRes.ok) {
          const data = await booksRes.json();
          setBooks(data.books || []);
        }
        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        console.error(err);
        toast.error(<T>Failed to load library</T>);
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  // Filter and search books
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Search in title, author, description
      const searchMatch =
        searchTerm === "" ||
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (book.author || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (book.description || "").toLowerCase().includes(searchTerm.toLowerCase());

      // Category filter
      const categoryMatch =
        selectedCategory === "" ||
        book.categories?.some((cat) => cat.id === selectedCategory);

      return searchMatch && categoryMatch;
    });
  }, [books, searchTerm, selectedCategory]);

  const getBookCover = (book: Book) => {
    if (book.cover_file_id) {
      return `/api/library/files/${book.cover_file_id}`;
    }
    if (book.cover_url) {
      return book.cover_url;
    }
    return "/placeholder-cover.png";
  };

  const handleReadBook = (book: Book) => {
    // If free or accessible, navigate to reader; else maybe show upgrade prompt
    if (book.access_type === "free") {
      router.push(`/library/read/${book.id}`);
    } else {
      // For simplicity, navigate anyway; access check will be done by API
      router.push(`/library/read/${book.id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8" dir="rtl">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">
          <T>Library</T>
        </h1>
        <p className="text-muted-foreground">
          <T>Browse our collection of interactive books</T>
        </p>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={<T>Search books...</T>}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-9"
            />
          </div>
          <select
            className="w-full sm:w-56 border border-input bg-background px-3 py-2 rounded-md text-foreground"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">
              <T>All Categories</T>
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name_ar || cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Books grid */}
      {filteredBooks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>
            <T>No books found</T>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredBooks.map((book) => (
            <Card
              key={book.id}
              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => handleReadBook(book)}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={getBookCover(book)}
                  alt={book.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  draggable={false}
                />
                {book.access_type !== "free" && (
                  <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    {book.access_type === "paid" ? (
                      <>
                        <Lock className="h-3 w-3" />
                        {book.price > 0 ? `$${book.price}` : "Premium"}
                      </>
                    ) : book.access_type === "partial" ? (
                      <>
                        <Unlock className="h-3 w-3" />
                        <T>Partial Free</T>
                      </>
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                  </div>
                )}
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-base line-clamp-2">{book.title}</CardTitle>
                {book.author && (
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                )}
              </CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-1">
                {book.categories?.slice(0, 2).map((cat) => (
                  <span
                    key={cat.id}
                    className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground"
                  >
                    {cat.name_ar || cat.name}
                  </span>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}