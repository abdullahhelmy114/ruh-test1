// src/app/api/library/books/id/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAuth, requireLibraryAccess } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: this folder is literally `id` (not `[id]`), so the route only
// matches /api/library/books/id and never received a real id. It is kept (no
// route deletions in this phase) but now requires library access and awaits
// Next 16 params, so it can no longer leak page images. REVIEW (Phase 5):
// rename to [id] or remove; /api/library/books?id= is the live detail route.
// Launch closure: the static segment has no params, so a missing id now
// answers 404 before any query instead of querying with undefined.
export const GET = withApi(async (req, ctx) => {
  const user = await requireAuth(req);
  await requireLibraryAccess(user);

  try {
    // A static segment is called without params at all, so there is nothing to destructure.
    const params: Record<string, string | string[]> = (await ctx.params) ?? {};
    const { id } = params;
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

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
});
