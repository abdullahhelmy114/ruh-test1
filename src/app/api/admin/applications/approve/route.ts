import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { verifyIdToken } from '@/lib/firebase/server';

export async function POST(req: Request) {
  try {
    // 1. تحقق من أن المستخدم أدمن
    const user = await verifyIdToken(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    // 2. استلام application_id من الطلب
    const { application_id } = await req.json();
    if (!application_id) {
      return NextResponse.json({ error: 'معرف الطلب مطلوب' }, { status: 400 });
    }

    // 3. جلب بيانات الطلب والتأكد من أنه بحالة pending
    const [app] = await sql`
      SELECT ta.id, ta.teacher_uid, ta.model_course_id
      FROM teaching_applications ta
      WHERE ta.id = ${application_id} AND ta.status = 'pending'
    `;
    if (!app) {
      return NextResponse.json({ error: 'الطلب غير موجود أو تمت معالجته مسبقاً' }, { status: 404 });
    }

    // 4. جلب بيانات الكورس النموذجي
    const [model] = await sql`
      SELECT id, title, description, level, price, category, scenario
      FROM model_courses
      WHERE id = ${app.model_course_id}
    `;
    if (!model) {
      return NextResponse.json({ error: 'الكورس النموذجي غير موجود' }, { status: 404 });
    }

    // 5. التأكد من أن المعلم موجود (من جدول profiles)
    const [teacher] = await sql`
      SELECT id, firebase_uid, full_name FROM profiles WHERE firebase_uid = ${app.teacher_uid}
    `;
    if (!teacher) {
      return NextResponse.json({ error: 'المعلم غير موجود' }, { status: 404 });
    }

    // 6. إنشاء الكورس الحي (live_course) - استخدم firebase_uid
    await sql`
      INSERT INTO live_courses (model_course_id, teacher_uid, title, description, level, price, status)
      VALUES (
        ${model.id},
        ${teacher.firebase_uid},
        ${model.title},
        ${model.description},
        ${model.level},
        ${model.price},
        'active'
      )
    `;

    // 7. تحديث حالة الطلب إلى approved
    await sql`
      UPDATE teaching_applications SET status = 'approved' WHERE id = ${application_id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 });
  }
}