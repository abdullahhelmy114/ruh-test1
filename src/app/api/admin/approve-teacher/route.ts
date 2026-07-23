import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

// التأكد من أن الاسم يطابق ما يرسله الـ Frontend
const approveSchema = z.object({
  teacherId: z.string().min(1, "معرف المعلم مطلوب"),
});

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من صلاحيات المشرف
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. تحليل الطلب والتحقق منه
    const body = await req.json();
    const { teacherId } = approveSchema.parse(body);

    // 3. تحديث دور المستخدم في قاعدة البيانات إلى 'teacher'
    const updatedUser = await sql.query(
      `UPDATE users SET role = 'teacher' WHERE id = $1 RETURNING id`,
      [teacherId]
    );

    if (!updatedUser || updatedUser.length === 0) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ message: "تمت الموافقة على المعلم بنجاح" }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      // استخدام issues بدلاً من errors لتوافق Zod
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error approving teacher:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}