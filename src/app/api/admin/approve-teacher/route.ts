import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من صلاحيات المشرف
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
}