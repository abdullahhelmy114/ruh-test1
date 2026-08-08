export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { userId, message } = await request.json();
    if (!userId || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // جلب بريد المستخدم
    const [user] = await sql`SELECT email, full_name FROM profiles WHERE firebase_uid = ${userId}`;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // إرسال إيميل (أو تخزين الرسالة في جدول messages)
    await sendEmail(user.email, 'Message from Admin', `<p>${message}</p>`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}