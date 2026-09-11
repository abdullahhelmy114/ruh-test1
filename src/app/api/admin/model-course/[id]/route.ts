import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

export const DELETE = withApi<{ id: string }>(async (req, ctx) => {
  await requireAdmin(req);
  const params = await ctx.params;

  try {
    // 1. التحقق من صلاحيات المشرف

    const courseId = params.id;
    if (!courseId) {
      return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
    }

    // 2. حذف الكورس من قاعدة البيانات
    await sql.query(`DELETE FROM model_course WHERE id = $1`, [courseId]);

    return NextResponse.json({ message: "تم حذف الكورس بنجاح" }, { status: 200 });
    
  } catch (error) {
    console.error("Error deleting model course:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});