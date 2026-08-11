// src/app/api/library/page-overlay/route.ts
import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { book_id, page_number, type, position, content } = body;

    // التحقق من الحقول المطلوبة
    if (!book_id || !page_number || !type || !position || !content) {
      return NextResponse.json(
        { error: "Missing required fields: book_id, page_number, type, position, content" },
        { status: 400 }
      );
    }

    // التحقق من صحة النوع
    const validTypes = ["audio", "video", "quiz", "game"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // التحقق من وجود الكتاب
    const [book] = await sql`SELECT id FROM library_books WHERE id = ${book_id}`;
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // إدراج التراكب الجديد
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