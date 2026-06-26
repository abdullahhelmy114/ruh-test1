export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  if (!uid) return NextResponse.json({ error: 'Missing uid' }, { status: 400 });

  try {
    // تم إصلاح الخطأ هنا: إضافة علامة (`) المغلقة في نهاية الاستعلام
    const [user] = await sql`SELECT * FROM profiles WHERE firebase_uid = ${uid}`;
    
    if (!user) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: user });
  } catch (error: any) {
    console.error("GET User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const uid = body.uid || "";
    const email = body.email || "";

    if (!uid || !email) {
      return NextResponse.json({ skipped: true });
    }

    const emailVerified = body.email_verified === true;
    
    // تجميع الاسم بالكامل ليتوافق مع عمود full_name
    let fullName = body.fullName || '';
    if (!fullName && body.first_name) {
       fullName = `${body.first_name} ${body.last_name || ''}`.trim();
    }

    // تحديد الحالة المبدئية
    const status = emailVerified ? 'active' : 'pending';

    // تم إصلاح الخطأ هنا: عدد الأعمدة يتطابق مع عدد القيم، وتصحيح ON CONFLICT
    await sql`
      INSERT INTO profiles (firebase_uid, email, full_name, role, status)
      VALUES (
        ${uid}, 
        ${email}, 
        ${fullName}, 
        ${body.role || 'student'}, 
        ${status}
      )
      ON CONFLICT (firebase_uid) DO UPDATE SET 
        email = EXCLUDED.email, 
        full_name = EXCLUDED.full_name,
        status = EXCLUDED.status
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}