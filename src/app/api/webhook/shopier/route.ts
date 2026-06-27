import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let body: Record<string, any> = {};

  // OSB يرسل البيانات عادة بصيغة form-data
  if (contentType.includes('application/json')) {
    body = await req.json();
  } else {
    const formData = await req.formData();
    body = Object.fromEntries(formData.entries());
  }

  // 1. التحقق من بيانات المصادقة الخاصة بـ OSB
  const osbUser = process.env.SHOPIER_OSB_USER;
  const osbPass = process.env.SHOPIER_OSB_PASS;

  if (!osbUser || !osbPass) {
    return NextResponse.json({ error: 'OSB credentials not configured' }, { status: 500 });
  }

  // في OSB، يتم إرسال API_key و API_secret أو ما يعادلهما في البيانات
  if (body.API_key !== osbUser || body.API_secret !== osbPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 403 });
  }

  // 2. التحقق من حالة الطلب (status = 'success' يعني الدفع تم)
  if (body.status !== 'success') {
    return NextResponse.json({ error: 'Payment not successful' }, { status: 400 });
  }

  // 3. استخراج معرف المنتج (الذي ربطنا به live_course_id أو bundle_id)
  const productId = body.product_id as string;
  const buyerEmail = body.buyer_email as string;

  if (!productId || !buyerEmail) {
    return NextResponse.json({ error: 'Missing product_id or buyer_email' }, { status: 400 });
  }

  try {
    // 4. فك تشفير product_id لمعرفة النوع والمعرف الحقيقي
    let type = '';
    let entityId = '';

    if (productId.startsWith('course_')) {
      type = 'course';
      entityId = productId.replace('course_', '');
    } else if (productId.startsWith('bundle_')) {
      type = 'bundle';
      entityId = productId.replace('bundle_', '');
    } else if (productId.startsWith('subscription_')) {
      type = 'subscription';
      entityId = productId.replace('subscription_', '');
    } else {
      return NextResponse.json({ error: 'Unknown product_id format' }, { status: 400 });
    }

    // 5. البحث عن المستخدم في قاعدة البيانات عن طريق بريده الإلكتروني
    const [user] = await sql`
      SELECT firebase_uid FROM profiles WHERE email = ${buyerEmail}
    `;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 6. معالجة الشراء حسب النوع
    if (type === 'course') {
      const [liveCourse] = await sql`
        SELECT id, price, teacher_id FROM live_courses WHERE id = ${entityId}
      `;
      if (!liveCourse) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

      // تسجيل الطالب في الكورس
      await sql`
        INSERT INTO enrollments (user_uid, course_id)
        VALUES (${user.firebase_uid}, ${liveCourse.id})
        ON CONFLICT (user_uid, course_id) DO NOTHING
      `;

      // احتساب عمولة المعلم (20%)
      const commission = parseFloat(liveCourse.price) * 0.2;
      await sql`
        INSERT INTO teacher_earnings (teacher_id, amount, status, source)
        VALUES (${liveCourse.teacher_id}, ${commission}, 'pending', 'shopier')
      `;
    } else if (type === 'bundle') {
      const [bundle] = await sql`
        SELECT course_ids, price FROM bundles WHERE id = ${entityId}
      `;
      if (!bundle) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });

      const courseIds: string[] = bundle.course_ids;
      const amountPerCourse = parseFloat(bundle.price) / courseIds.length;

      for (const cid of courseIds) {
        await sql`
          INSERT INTO enrollments (user_uid, course_id)
          VALUES (${user.firebase_uid}, ${cid})
          ON CONFLICT (user_uid, course_id) DO NOTHING
        `;

        const [course] = await sql`SELECT teacher_id FROM live_courses WHERE id = ${cid}`;
        if (course) {
          const commission = amountPerCourse * 0.2;
          await sql`
            INSERT INTO teacher_earnings (teacher_id, amount, status, source)
            VALUES (${course.teacher_id}, ${commission}, 'pending', 'shopier')
          `;
        }
      }
    } else if (type === 'subscription') {
      const planId = entityId;
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 3 أشهر

      await sql`
        INSERT INTO subscriptions (user_id, plan_id, expires_at, max_courses, courses_used)
        VALUES (${user.firebase_uid}, ${planId}, ${expiresAt}, 3, 0)
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}