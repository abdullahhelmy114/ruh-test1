// src/app/api/library/books/[id]/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [book] = await sql`
      SELECT id, title, author, description, cover_url, created_at
      FROM library_books
      WHERE id = ${id}
    `;
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // جلب التصنيفات (مع تأكيد النوع لتجنب خطأ TS)
    let categories: { id: string; name: string; slug: string }[] = [];
    try {
      const cats = await sql`
        SELECT c.id, c.name, c.slug
        FROM book_categories bc
        JOIN categories c ON c.id = bc.category_id
        WHERE bc.book_id = ${id}
      `;
      // تأكيد النوع يدويًا
      categories = (cats as any[]).map((c: any) => ({
        id: c.id as string,
        name: c.name as string,
        slug: c.slug as string,
      }));
    } catch (e) {
      console.warn("Could not fetch categories:", e);
    }

    // جلب الصفحات
    const pages = await sql`
      SELECT page_number, image_url
      FROM library_pages
      WHERE book_id = ${id}
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