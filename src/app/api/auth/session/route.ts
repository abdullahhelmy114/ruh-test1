import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: 1000 * 60 * 60 * 24 * 14,
    });

    // جلب الدور الحقيقي للمستخدم من قاعدة البيانات
    const [profile] = await sql`SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}`;
    const role = profile?.role || "student";

    // إرسال الدور مع الاستجابة لكي تعرف صفحة الدخول أين توجهه
    const response = NextResponse.json({ success: true, role }); 
    
    response.cookies.set("__session", sessionCookie, {
      maxAge: 60 * 60 * 24 * 14,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}