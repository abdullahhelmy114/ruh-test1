/**
 * Application wiring for the central auth service.
 *
 * Import guards from here in API routes:
 *
 *   import { requireAdmin } from "@/lib/auth";
 *   const user = await requireAdmin(req);
 *
 * The service itself lives in ./core (dependency-free, unit-tested).
 */
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import {
  createAuthService,
  type AuthDeps,
  type ProfileRecord,
} from "./core";

export {
  AuthError,
  ROLES,
  SESSION_COOKIE_NAME,
  type AuthUser,
  type Role,
  type AuthService,
} from "./core";

const deps: AuthDeps = {
  async verifyIdToken(token) {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? null };
  },
  async verifySessionCookie(cookie) {
    // checkRevoked = true so a revoked Firebase session cannot keep a cookie alive.
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  },
  async findProfileByFirebaseUid(uid) {
    const rows = (await sql`
      SELECT id, firebase_uid, role, email
      FROM profiles
      WHERE firebase_uid = ${uid}
      LIMIT 1
    `) as ProfileRecord[];
    return rows[0] ?? null;
  },
};

const service = createAuthService(deps);

export const getSession = service.getSession;
export const requireAuth = service.requireAuth;
export const requireRole = service.requireRole;
export const requireAdmin = service.requireAdmin;
export const requireTeacher = service.requireTeacher;
export const requireStudent = service.requireStudent;
export const requireSelfOrAdmin = service.requireSelfOrAdmin;

/**
 * Backwards-compatible alias for the pre-Phase-1 helper in `@/lib/auth`.
 * Returns the same `{ uid, role }` shape callers already expect (plus
 * profileId/email). New code should use `getSession`/`require*`.
 */
export const getServerSession = service.getSession;
