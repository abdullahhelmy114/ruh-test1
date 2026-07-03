import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";

export async function verifyIdToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  // إذا لم يوجد توكن، ربما استخدمنا middleware لإضافة userId في الهيدر
  if (!token) {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role");
    if (userId && role) return { uid: userId, role };
    return null;
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    // جلب الدور من profiles إن لم يكن موجوداً في custom claims
    let role = decoded.role;
    if (!role) {
      const [profile] = await sql`
        SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}
      `;
      role = profile?.role || "student";
    }

    return { uid: decoded.uid, role };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}