import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.3a: AUTH MIGRATION ONLY — the legacy verifyIdToken shim is replaced
// by the central requireAdmin guard. The database write below is unchanged.
// REVIEW_REQUIRED (Phase 4): it updates a `users` table that the repository
// schema does not define, while authorization reads `profiles.role`, so this
// approval does not currently take effect. Not fixed here by decision.
export const POST = withApi(async (req) => {
  // 1. التحقق من صلاحيات المشرف
  await requireAdmin(req);

  try {
    // 2. قراءة البيانات المرسلة
    const body = await req.json();
    
    // 3. استخراج المعرف بأي اسم تم إرساله (بدون تعقيدات Zod)
    const targetId = body.uid || body.teacherId || body.id;

    if (!targetId) {
      return NextResponse.json(
        { error: [{ message: "لم يتم العثور على معرف المعلم في الطلب" }] }, 
        { status: 400 }
      );
    }

    // 4. التحديث في قاعدة البيانات باستخدام طريقتك الصحيحة (await sql)
    const updatedUser = await sql`
      UPDATE users 
      SET role = 'teacher' 
      WHERE id = ${targetId} 
      RETURNING id
    `;

    if (updatedUser.length === 0) {
      return NextResponse.json({ error: "المستخدم غير موجود في قاعدة البيانات" }, { status: 404 });
    }

    // 5. إرجاع رسالة نجاح
    return NextResponse.json({ message: "تمت الموافقة على المعلم بنجاح" }, { status: 200 });

  } catch (error) {
    console.error("Server Error in approve-teacher:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});