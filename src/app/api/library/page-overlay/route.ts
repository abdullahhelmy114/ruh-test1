// src/app/api/library/page-overlay/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

// GET: جلب تراكبات كتاب معين
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  if (!bookId) {
    return NextResponse.json({ error: "bookId query parameter is required" }, { status: 400 });
  }
  try {
    const overlays = await sql`
      SELECT id, book_id, page_number, type, position, content
      FROM page_overlays
      WHERE book_id = ${bookId}
      ORDER BY page_number ASC, id ASC
    `;
    return NextResponse.json({ overlays });
  } catch (error) {
    console.error("Error fetching overlays:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: إضافة تراكب جديد (للأدمن)
export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { book_id, page_number, type, position, content } = body;
    if (!book_id || !page_number || !type || !position || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const [overlay] = await sql`
      INSERT INTO page_overlays (book_id, page_number, type, position, content)
      VALUES (${book_id}, ${page_number}, ${type}, ${position}, ${content})
      RETURNING id, book_id, page_number, type, position, content
    `;
    return NextResponse.json({ overlay }, { status: 201 });
  } catch (error) {
    console.error("Error creating overlay:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}