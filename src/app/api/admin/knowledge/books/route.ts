import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export const GET = withApi(async (req) => {
  try {
    // التحقق من الصلاحية
    await requireAdmin(req);

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
});