import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db/client";
import { verifyIdToken } from "@/lib/firebase/server";

// جعلنا الـ Schema مرناً ليقبل أي اسم للمعرف يرسله الـ Frontend
const approveSchema = z.object({
  teacherId: z.string().optional(),
  id: z.string().optional(),
  userId: z.string().optional(),
  uid: z.string().optional(), // <-- أضفنا uid هنا
}).refine(data => data.teacherId || data.id || data.userId || data.uid, {
  message: "لم يتم العثور على معرف المعلم في الطلب",
});

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyIdToken(req);
    if (!adminUser || adminUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("البيانات المستلمة من الواجهة:", body); // للمساعدة في التتبع

    const parsedData = approveSchema.parse(body);
    
    // استخراج الـ ID أياً كان اسمه
    const targetId = parsedData.teacherId || parsedData.id || parsedData.userId || parsedData.uid;

    const updatedUser = await sql.query(
      `UPDATE users SET role = 'teacher' WHERE id = $1 RETURNING id`,
      [targetId]
    );

    if (!updatedUser || updatedUser.length === 0) {
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ message: "تمت الموافقة على المعلم بنجاح" }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod Validation Error:", error.issues);
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}