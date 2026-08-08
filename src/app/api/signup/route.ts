import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email, name, captchaToken } = await request.json();

    if (!email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
    }

    // التحقق من reCAPTCHA
    if (captchaToken) {
      const recaptchaRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
      });
      const recaptchaData = await recaptchaRes.json();
      if (!recaptchaData.success) {
        return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 });
      }
    }

    // إرسال بريد الترحيب
    await sendEmail(
      email,
      'Welcome to Ruhulqudus Academy!',
      `<h1>Welcome, ${name}!</h1>
       <p>Your account has been created successfully.</p>
       <p>Start your learning journey today: <a href="https://ruhulqudus.net/marketplace">Browse Courses</a></p>`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}