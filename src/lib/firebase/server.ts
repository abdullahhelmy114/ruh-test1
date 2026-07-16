import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";

const ADMIN_EMAILS = ["abdullahhelmy114@gmail.com", "info@ruhulqudus.com"];

export async function verifyIdToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    const userId = req.headers.get("x-user-id");
    const role = req.headers.get("x-user-role");
    if (userId && role) return { uid: userId, role };
    return null;
  }

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    let role = decoded.role;
    const email = decoded.email || "";

    // إذا لم يوجد دور في claims، نحاول من profiles
    if (!role) {
      try {
        const [profile] = await sql`
          SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}
        `;
        role = profile?.role;
      } catch (e) {
        console.error("Failed to fetch role from DB", e);
      }
    }

    // احتياطي: إذا لم نجد دورًا، وكان البريد ضمن قائمة المدراء، نعطيه admin
    if (!role && ADMIN_EMAILS.includes(email)) {
      role = "admin";
    }

    // افتراضي student
    if (!role) role = "student";

    return { uid: decoded.uid, role, email };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}