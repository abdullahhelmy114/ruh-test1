import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// إنشاء اتصال مباشر وسريع مع Neon PostgreSQL
const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // 1. التحقق من صحة الإيميل مدخلات المستخدم
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // 2. إنشاء جدول قائمة الانتظار تلقائياً إن لم يكن مسبقاً في Neon
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. التحقق مما إذا كان الإيميل مسجلاً مسبقاً لمنع التكرار
    const existingUser = await sql`
      SELECT id FROM waitlist WHERE email = ${email} LIMIT 1;
    `;

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: "This email is already on the waitlist!" },
        { status: 400 }
      );
    }

    // 4. إدراج الإيميل الجديد في قاعدة البيانات
    await sql`
      INSERT INTO waitlist (email) VALUES (${email});
    `;

    return NextResponse.json(
      { message: "Successfully joined the waitlist" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Neon DB Error:", error);
    return NextResponse.json(
      { error: "Database connection failed. Please try again." },
      { status: 500 }
    );
  }
}
