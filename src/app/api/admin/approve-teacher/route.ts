import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email";

function teacherApprovedEmail(name: string) {
  return `
    <div style="text-align:center">
      <h2>مبروك ${name}!</h2>
      <p>تم قبول طلبك للتدريس في أكاديمية روح القدس.</p>
      <p>يمكنك الآن تسجيل الدخول والبدء بإنشاء دوراتك.</p>
      <a href="https://ruhulqudus.net/login">تسجيل الدخول</a>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await req.json();
    if (!uid) return NextResponse.json({ message: "Missing uid" }, { status: 400 });

    const [user] = await sql`SELECT * FROM users WHERE uid = ${uid} AND role = 'teacher'`;
    if (!user) return NextResponse.json({ message: "Teacher not found" }, { status: 404 });

    await sql`UPDATE users SET status = 'active' WHERE uid = ${uid}`;

    // إرسال إيميل ترحيبي
    await sendEmail(
      user.email,
      "تم تفعيل حسابك كمعلم",
      teacherApprovedEmail(user.first_name || "معلم")
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}