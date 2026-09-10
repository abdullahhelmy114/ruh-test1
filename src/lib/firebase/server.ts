import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";

/**
 * Verifies a Firebase ID token from the Authorization header and resolves the
 * user's role from the `profiles` table.
 *
 * Phase 0 containment: the previous implementation accepted unauthenticated
 * `x-user-id` / `x-user-role` headers and a hardcoded admin-email allowlist.
 * Both are removed. Identity now comes only from a verified token, and role
 * only from the database. This helper is slated for replacement by the
 * central auth module in Phase 1/2; do not add new callers.
 */
export async function verifyIdToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) return null;

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);

    const [profile] = await sql`
      SELECT role FROM profiles WHERE firebase_uid = ${decoded.uid}
    `;

    if (!profile) return null;

    const role: string = profile.role || "student";
    return { uid: decoded.uid, role, email: decoded.email || "" };
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
