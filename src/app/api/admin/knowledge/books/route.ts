import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // جلب أسماء الكتب الفريدة من قاعدة البيانات مع عدد الأجزاء (Chunks) لكل كتاب
    const books = await sql`
      SELECT book_title, COUNT(id) as chunks_count, MIN(created_at) as uploaded_at
      FROM knowledge_base
      GROUP BY book_title
      ORDER BY uploaded_at DESC
    `;

    return NextResponse.json({ success: true, books: books || [] }, { status: 200 });

  } catch (error) {
    console.error("Fetch Books Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}