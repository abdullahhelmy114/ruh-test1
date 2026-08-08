import { NextResponse } from 'next/server';
import { createShopierPaymentLink } from '@/lib/shopier';
import { getServerSession } from '@/lib/auth';
import { sql } from '@/lib/db/client';

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
  }

  const body = await req.json();
  const { liveCourseId, bundleId, planId, type, title, price } = body;

  try {
    let paymentTitle = title;
    let paymentPrice = price;
    let paymentType = type;

    if (type === 'course' && liveCourseId) {
      const [course] = await sql`
        SELECT title, price FROM courses WHERE id = ${liveCourseId}
      `;
      if (!course) return NextResponse.json({ error: 'الكورس غير موجود' }, { status: 404 });
      paymentTitle = course.title;
      paymentPrice = Number(course.price);
      paymentType = 'course';
    } else if (type === 'bundle' && bundleId) {
      // ... (بدون تغيير)
    } else if (type === 'subscription' && planId) {
      // ...
    }

    const paymentUrl = await createShopierPaymentLink({
      liveCourseId,
      bundleId,
      planId,
      title: paymentTitle,
      price: paymentPrice,
      type: paymentType,
    });

    return NextResponse.json({ paymentUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ' }, { status: 500 });
  }
}