import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/lib/db/client';
import { getServerSession } from '@/lib/auth';

const applySchema = z.object({
  model_course_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session || session.role !== 'teacher') {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { model_course_id } = applySchema.parse(body);

    const teacherUid = session.uid;

    // 1. التأكد من أن الكورس النموذجي موجود ومعتمد
    const [model] = await sql`
      SELECT id FROM model_courses WHERE id = ${model_course_id} AND status = 'approved'
    `;
    if (!model) {
      return NextResponse.json({ error: 'الكورس غير متاح' }, { status: 400 });
    }

    // 2. التحقق من عدم وجود طلب مسبق أو كورس حي لنفس المعلم
    const existingApplication = await sql`
      SELECT id FROM teaching_applications
      WHERE teacher_uid = ${teacherUid} AND model_course_id = ${model_course_id}
    `;
    if (existingApplication.length > 0) {
      return NextResponse.json({ error: 'لديك طلب مسبق لهذا الكورس' }, { status: 409 });
    }

    // 3. التحقق من عدم وجود كورس حي بالفعل لهذا المعلم
    const existingLive = await sql`
      SELECT lc.id FROM live_courses lc
      JOIN profiles p ON lc.teacher_id = p.id
      WHERE p.firebase_uid = ${teacherUid} AND lc.model_course_id = ${model_course_id}
    `;
    if (existingLive.length > 0) {
      return NextResponse.json({ error: 'أنت تقوم بتدريس هذا الكورس بالفعل' }, { status: 409 });
    }

    // 4. إنشاء طلب التدريس
    await sql`
      INSERT INTO teaching_applications (teacher_uid, model_course_id, status)
      VALUES (${teacherUid}, ${model_course_id}, 'pending')
    `;

    return NextResponse.json({ message: 'تم تقديم الطلب' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 422 });
    }
    console.error('Apply error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}