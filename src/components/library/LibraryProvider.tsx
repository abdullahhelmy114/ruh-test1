// src/components/library/LibraryProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";

// ── الأنواع ──────────────────────────────────────
export interface BookCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_url?: string;
  category?: string; // للتوافق المؤقت
  categories?: BookCategory[]; // تصنيفات متعددة
  year?: string;
  pages_count?: number;
  created_at: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  name_ar?: string;
  slug: string;
  description?: string;
  parent_id: string | null;
}

interface LibraryContextValue {
  books: Book[];
  categories: CategoryNode[];
  hasAccess: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── السياق ────────────────────────────────────────
const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) {
    throw new Error("useLibrary must be used within <LibraryProvider>");
  }
  return ctx;
}

// ── المزوّد ────────────────────────────────────────
export function LibraryProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // نجلب الصلاحيات والكتب والتصنيفات بالتوازي
      const [accessRes, booksRes, categoriesRes] = await Promise.all([
        authFetch("/api/library/access"),
        fetch("/api/library/books"),
        fetch("/api/categories"),
      ]);

      const accessData = await accessRes.json();
      setHasAccess(accessData.hasAccess);
      setIsAdmin(accessData.isAdmin || false);

      if (booksRes.ok) {
        const booksData = await booksRes.json();
        setBooks(booksData.books || []);
      }

      if (categoriesRes.ok) {
        const catsData = await categoriesRes.json();
        setCategories(catsData.categories || []);
      }
    } catch (err) {
      console.error("Library fetch error:", err);
      setError("Failed to load library data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [user, authLoading]);

  const value: LibraryContextValue = {
    books,
    categories,
    hasAccess,
    isAdmin,
    loading: loading || authLoading,
    error,
    refresh: fetchData,
  };

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}