// src/app/api/library/books/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET() {
  try {
    // 1. جلب جميع الكتب
    const books = await sql`
      SELECT id, title, author, description, cover_url, year, pages_count, created_at
      FROM library_books
      ORDER BY created_at DESC
    `;

    // 2. جلب التصنيفات لكل كتاب
    const bookIds = books.map((b) => b.id);
    let categoriesByBook: Record<string, { id: string; name: string; slug: string }[]> = {};

    if (bookIds.length > 0) {
      const cats = await sql`
        SELECT bc.book_id, c.id, c.name, c.slug
        FROM book_categories bc
        JOIN categories c ON c.id = bc.category_id
        WHERE bc.book_id = ANY(${bookIds})
      `;

      // تجميع التصنيفات حسب book_id
      for (const row of cats) {
        if (!categoriesByBook[row.book_id]) {
          categoriesByBook[row.book_id] = [];
        }
        categoriesByBook[row.book_id].push({
          id: row.id,
          name: row.name,
          slug: row.slug,
        });
      }
    }

    // 3. دمج النتائج
    const result = books.map((book) => ({
      ...book,
      categories: categoriesByBook[book.id] || [],
      // حقل category القديم (للتوافق المؤقت) – يأخذ slug أول تصنيف
      category: categoriesByBook[book.id]?.[0]?.slug || null,
    }));

    return NextResponse.json({ books: result });
  } catch (error) {
    console.error("Library books fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}