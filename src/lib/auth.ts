import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";

export async function getServerSession(req: Request): Promise<{
  uid: string;
  role: "student" | "teacher" | "admin";
} | null> {
  try {
    let token = "";
    let isSessionCookie = false;

    // 1. محاولة استخراج التوكن من الهيدر
    const authHeader = req.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // 2. إذا لم يوجد، نقرأ التوكن من الكوكي
    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/__session=([^;]+)/);
      if (match) {
        token = match[1];
        isSessionCookie = true;
      }
    }

    if (!token) return null;

    const auth = getAdminAuth();
    let decoded;

    // 3. فك التشفير بالدالة الصحيحة
    if (isSessionCookie) {
      decoded = await auth.verifySessionCookie(token, true);
    } else {
      decoded = await auth.verifyIdToken(token);
    }

    if (!decoded.uid) return null;

    // 4. 🔥 الحل النهائي: الاعتماد حصرياً على جدول profiles 🔥
    const records = await sql`
      SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}
    `;

    // إذا لم يجد الحساب في قاعدة البيانات
    if (!records || records.length === 0) {
      return null; 
    }

    return {
      uid: decoded.uid,
      role: records[0].role || "student",
    };
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}