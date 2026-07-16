import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const [book] = await sql`
      SELECT id, title, author, description, cover_url, pdf_url, created_at
      FROM library_books WHERE id = ${params.id}
    `;
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const pages = await sql`
      SELECT page_number, image_url FROM library_pages
      WHERE book_id = ${params.id} ORDER BY page_number ASC
    `;

    return NextResponse.json({ book, pages });
  } catch (error) {
    console.error("Fetch book error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}