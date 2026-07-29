import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // التحقق من الصلاحية
    const user = await verifyIdToken(req);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    // جلب قائمة الكتب من قاعدة المعرفة
    const books = await sql`
      SELECT id, title, file_uri, created_at
      FROM gemini_books
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ success: true, books: books || [] });
  } catch (error) {
    console.error("خطأ في جلب كتب Gemini:", error);
    return NextResponse.json({ error: "فشل جلب الكتب من قاعدة البيانات" }, { status: 500 });
  }
}