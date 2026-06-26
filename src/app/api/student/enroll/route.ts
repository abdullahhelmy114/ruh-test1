export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';

export async function POST(request: Request) {
  try {
    const { uid, courseId } = await request.json();
    if (!uid || !courseId) return NextResponse.json({ error: 'Missing uid or courseId' }, { status: 400 });

    // 🔥 جلب المعرف الحقيقي من قاعدة البيانات
    const [user] = await sql`SELECT id FROM profiles WHERE firebase_uid = ${uid}`;
    
    if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    // 🔥 الإدخال باستخدام المعرف الصحيح
    await sql`
      INSERT INTO enrollments (user_id, course_id) 
      VALUES (${user.id}, ${courseId}) 
      ON CONFLICT (user_id, course_id) DO NOTHING
    `;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}