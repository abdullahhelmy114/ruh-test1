// src/app/api/library/books/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("id");

  // ---------- جلب كتاب واحد ----------
  if (bookId) {
    try {
      const [book] = await sql`
        SELECT id, title, author, description, cover_url, pdf_url, created_at
        FROM library_books
        WHERE id = ${bookId}
      `;
      if (!book) {
        return NextResponse.json({ error: "Book not found" }, { status: 404 });
      }

      // جلب التصنيفات
      let categories: { id: string; name: string; slug: string }[] = [];
      try {
        const cats = await sql`
          SELECT c.id, c.name, c.slug
          FROM book_categories bc
          JOIN categories c ON c.id = bc.category_id
          WHERE bc.book_id = ${bookId}
        `;
        categories = (cats as any[]).map((c: any) => ({
          id: c.id as string,
          name: c.name as string,
          slug: c.slug as string,
        }));
      } catch (e) {
        console.warn("Could not fetch categories:", e);
      }

      // جلب الصفحات (للتوافق مع النظام القديم – قد لا تكون ضرورية بعد التحويل للـ PDF المباشر)
      const pages = await sql`
        SELECT page_number, image_url
        FROM library_pages
        WHERE book_id = ${bookId}
        ORDER BY page_number ASC
      `;

      return NextResponse.json({
        book: {
          ...book,
          categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
          category: categories[0]?.slug || null,
        },
        pages: (pages as any[]).map((p: any) => ({
          page_number: p.page_number,
          image_url: p.image_url,
        })),
      });
    } catch (error) {
      console.error("Error fetching book details:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ---------- جلب قائمة الكتب ----------
  try {
    const books = await sql`
      SELECT id, title, author, description, cover_url, pdf_url, created_at
      FROM library_books
      ORDER BY created_at DESC
    `;

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
      } catch (e) {
        console.warn("book_categories join failed:", e);
      }
    }

    const result = books.map((book: any) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      description: book.description,
      cover_url: book.cover_url,
      pdf_url: book.pdf_url, // متوفر الآن
      year: null,
      pages_count: null,
      created_at: book.created_at,
      categories: categoriesByBook[book.id] || [],
      category: categoriesByBook[book.id]?.[0]?.slug || null,
    }));

    return NextResponse.json({ books: result });
  } catch (error) {
    console.error("Library books fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}