import { getAdminAuth } from "@/lib/firebase/admin";

export async function verifyIdToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    // إذا لم يوجد توكن، ربما استخدمنا middleware لإضافة userId في الهيدر
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role");
    if (userId && role) return { uid: userId, role };
    return null;
  }

  try {
    const auth = getAdminAuth(); // التهيئة الكسولة هنا
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, role: decoded.role || "teacher" };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}