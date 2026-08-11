// src/app/api/library/books/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET() {
  try {
    // 1. جلب الكتب بدون year و pages_count (غير موجودين بعد)
    const books = await sql`
      SELECT id, title, author, description, cover_url, category, created_at
      FROM library_books
      ORDER BY created_at DESC
    `;

    // 2. جلب التصنيفات من جدول book_categories إذا وُجد
    const bookIds = books.map((b: any) => b.id);
    let categoriesByBook: Record<string, { id: string; name: string; slug: string }[]> = {};

    if (bookIds.length > 0) {
      try {
        const cats = await sql`
          SELECT bc.book_id, c.id, c.name, c.slug
          FROM book_categories bc
          JOIN categories c ON c.id = bc.category_id
          WHERE bc.book_id = ANY(${bookIds})
        `;

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
      } catch (joinError) {
        // قد لا يكون جدول book_categories موجوداً بعد، نتجاهل الخطأ
        console.warn("book_categories join failed (table may not exist):", joinError);
      }
    }

    // 3. دمج النتائج مع حقول افتراضية
    const result = books.map((book: any) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      cover_url: book.cover_url,
      year: null,           // سيُضاف لاحقاً
      pages_count: null,    // سيُضاف لاحقاً
      created_at: book.created_at,
      categories: categoriesByBook[book.id] || [],
      // حقل category القديم للتوافق (يأخذ slug أول تصنيف)
      category: categoriesByBook[book.id]?.[0]?.slug || book.category || null,
    }));

    return NextResponse.json({ books: result });
  } catch (error) {
    console.error("Library books fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}