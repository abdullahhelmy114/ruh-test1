export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sendEmail, contactFormEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { name, email, message, captchaToken } = await request.json();
    if (!name || !email || !message || !captchaToken) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // إرسال الإيميل للإدارة
    await sendEmail(
      'info@ruhulqudus.com',
      'New Contact Message',
      contactFormEmail(name, email, message)
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}