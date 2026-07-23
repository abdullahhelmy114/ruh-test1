import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getAdminAuth } from "@/lib/firebase/admin"; // 🛑 تمت إضافة Firebase Admin

export async function POST(req: NextRequest) {
  try {
    const { email, emailCode } = await req.json();

    if (!email || !emailCode) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
    }

    const users = await sql`SELECT firebase_uid FROM profiles WHERE email = ${email} AND role = 'teacher'`;
    if (users.length === 0) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    const userUid = users[0].firebase_uid;

    const codes = await sql`
      SELECT email_code, expires_at FROM verification_codes
      WHERE user_uid = ${userUid} AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;
    
    if (codes.length === 0) return NextResponse.json({ message: "No valid code found or code expired" }, { status: 400 });
    if (codes[0].email_code !== emailCode) return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });

    // 🛑 الأهم: تفعيل الإيميل في Firebase!
    await getAdminAuth().updateUser(userUid, { emailVerified: true });

    // تفعيل قاعدة البيانات
    await sql`UPDATE profiles SET email_verified = TRUE WHERE firebase_uid = ${userUid}`;
    await sql`DELETE FROM verification_codes WHERE user_uid = ${userUid}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Teacher Verification error:", error);
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 });
  }
}