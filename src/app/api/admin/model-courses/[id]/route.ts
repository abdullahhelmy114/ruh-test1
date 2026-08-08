import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. التحقق من صلاحيات المشرف
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const courseId = params.id;
    if (!courseId) {
      return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
    }

    // 2. حذف الكورس من قاعدة البيانات
    await sql.query(`DELETE FROM model_courses WHERE id = $1`, [courseId]);

    return NextResponse.json({ message: "تم حذف الكورس بنجاح" }, { status: 200 });
    
  } catch (error) {
    console.error("Error deleting model course:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}