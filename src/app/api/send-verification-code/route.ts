export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { sendEmail, verificationCodeEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    // إنشاء كود عشوائي من 6 أرقام
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // صالح لمدة 15 دقيقة

    // حذف أي كود سابق لنفس البريد
    await sql`DELETE FROM email_verifications WHERE email = ${email}`;

    // تخزين الكود الجديد
    await sql`INSERT INTO email_verifications (email, code, expires_at) VALUES (${email}, ${code}, ${expiresAt})`;

    // إرسال الكود عبر البريد باستخدام القالب الجديد
    await sendEmail(email, 'Your Verification Code', verificationCodeEmail(code));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}