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
  AuthError as AuthErrorRef,
  createAuthService,
  createEnrollmentGuard,
  type AuthDeps,
  type AuthUser,
  type ProfileRecord,
} from "./core";

export {
  ACTIVE_ACCOUNT_STATUS,
  AuthError,
  HttpError,
  ROLES,
  sessionRoleFor,
  type SessionRole,
  SESSION_COOKIE_NAME,
  type AuthUser,
  type Role,
  type AuthService,
  type RequireEnrolled,
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
      SELECT id, firebase_uid, role, email, status
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
 * requireEnrolled(user, courseId) — throws 403 unless the verified user is
 * enrolled in the course (admins bypass). Enrollment is keyed by the Firebase
 * uid, matching every existing `enrollments` query in the codebase.
 */
export const requireEnrolled = createEnrollmentGuard({
  async isEnrolled(uid, courseId) {
    const rows = await sql`
      SELECT 1 FROM enrollments
      WHERE user_uid = ${uid} AND course_id = ${courseId}
      LIMIT 1
    `;
    return rows.length > 0;
  },
});

/**
 * Library entitlement (distinct from course enrollment). Mirrors the rules in
 * /api/library/access: admins always have access; otherwise an unexpired
 * `library_access` row for the caller grants access, with an optional role.
 */
export interface LibraryAccess {
  hasAccess: boolean;
  isAdmin: boolean;
  role: string | null;
}

export async function getLibraryAccess(user: AuthUser): Promise<LibraryAccess> {
  if (user.role === "admin") return { hasAccess: true, isAdmin: true, role: "admin" };
  const [access] = await sql`
    SELECT id, expires_at, role
    FROM library_access
    WHERE user_uid = ${user.uid}
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `;
  if (!access) return { hasAccess: false, isAdmin: false, role: null };
  return { hasAccess: true, isAdmin: false, role: access.role || "student" };
}

/** Throws 403 unless the caller has library access; returns the access record. */
export async function requireLibraryAccess(user: AuthUser): Promise<LibraryAccess> {
  const access = await getLibraryAccess(user);
  if (!access.hasAccess) throw new AuthErrorRef("FORBIDDEN", "Library access required");
  return access;
}

/**
 * Backwards-compatible alias for the pre-Phase-1 helper in `@/lib/auth`.
 * Returns the same `{ uid, role }` shape callers already expect (plus
 * profileId/email). New code should use `getSession`/`require*`.
 */
export const getServerSession = service.getSession;
