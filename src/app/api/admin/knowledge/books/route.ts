import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // جلب أسماء الكتب من الجدول الجديد (gemini_books)
    const books = await sql`
      SELECT id, title, file_uri, created_at
      FROM gemini_books
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ success: true, books: books || [] }, { status: 200 });

  } catch (error) {
    console.error("Fetch Gemini Books Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}