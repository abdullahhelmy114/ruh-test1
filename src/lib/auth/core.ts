/**
 * Central authentication / authorization core.
 *
 * This module is intentionally dependency-free. All I/O (Firebase Admin,
 * database) is injected through `AuthDeps`, which keeps the security logic
 * unit-testable without real credentials and guarantees a single code path
 * for every route.
 *
 * Identity chain (the only one the server trusts):
 *
 *   Authorization: Bearer <Firebase ID token>   OR   __session cookie
 *          ↓ verified by Firebase Admin
 *   firebaseUid
 *          ↓ looked up in profiles.firebase_uid
 *   { uid, profileId, role, email }
 *
 * Nothing else — not request bodies, query strings, custom headers, or
 * browser storage — may establish who the caller is or what role they hold.
 */

export type Role = "admin" | "teacher" | "student";

export const ROLES: readonly Role[] = ["admin", "teacher", "student"] as const;

/**
 * What a session may act as. It equals the stored account role, except that a
 * teacher account whose status is not exactly "active" (an application that is
 * pending, needs changes, was rejected or withdrawn, or a deactivated teacher)
 * acts as an "applicant": it may manage only its own account and application,
 * and holds neither teacher nor student privileges.
 */
export type SessionRole = Role | "applicant";

/** The only profile status that grants a teacher account its teaching role. */
export const ACTIVE_ACCOUNT_STATUS = "active";

/** Minimal, non-sensitive view of the authenticated caller. */
export interface AuthUser {
  /** Firebase UID; canonical application identity (profiles.firebase_uid). */
  uid: string;
  /** profiles.id (UUID) for tables that key on it. */
  profileId: string;
  /** The role this session acts as (see SessionRole). Authorization uses this. */
  role: SessionRole;
  email: string | null;
  /** The stored profiles.role, for routing and account views (never for authorization). */
  accountRole?: Role;
  /** The stored profiles.status. */
  accountStatus?: string | null;
}

/** Row shape returned by the profile lookup dependency. */
export interface ProfileRecord {
  id: string;
  firebase_uid: string;
  role: string | null;
  email: string | null;
  status?: string | null;
}

/** The session role for a stored role and status (see SessionRole). */
export function sessionRoleFor(role: Role, status: string | null | undefined): SessionRole {
  return role === "teacher" && status !== ACTIVE_ACCOUNT_STATUS ? "applicant" : role;
}

export interface VerifiedCredential {
  uid: string;
  email?: string | null;
}

export interface AuthDeps {
  verifyIdToken(token: string): Promise<VerifiedCredential>;
  verifySessionCookie(cookie: string): Promise<VerifiedCredential>;
  findProfileByFirebaseUid(uid: string): Promise<ProfileRecord | null>;
}

export type AuthErrorCode = "UNAUTHORIZED" | "FORBIDDEN";

export class AuthError extends Error {
  readonly status: 401 | 403;
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? (code === "UNAUTHORIZED" ? "Unauthorized" : "Forbidden"));
    this.name = "AuthError";
    this.code = code;
    this.status = code === "UNAUTHORIZED" ? 401 : 403;
  }
}

export const SESSION_COOKIE_NAME = "__session";

/**
 * Client-facing error with an explicit HTTP status (validation, not-found,
 * conflict). Message must be safe to return to the client.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Serializable error response used by `withApi`; never leaks internals. */
export interface ErrorResponseShape {
  status: number;
  body: { error: string; code?: AuthErrorCode };
}

export function toErrorResponse(error: unknown): ErrorResponseShape {
  if (error instanceof AuthError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.message } };
  }
  return { status: 500, body: { error: "Internal server error" } };
}

// ---------------------------------------------------------------------------
// Enrollment guard (Phase 2.4a)
// ---------------------------------------------------------------------------

/**
 * Enrollment is membership in `enrollments(user_uid = firebase uid, course_id)`.
 * It is NOT paid entitlement (library access, subscriptions) — those are
 * separate concepts with their own helpers.
 */
export interface EnrollmentDeps {
  isEnrolled(uid: string, courseId: string): Promise<boolean>;
}

export type RequireEnrolled = (user: AuthUser, courseId: unknown) => Promise<void>;

export function createEnrollmentGuard(deps: EnrollmentDeps): RequireEnrolled {
  return async function requireEnrolled(user, courseId) {
    if (typeof courseId !== "string" || courseId.trim() === "") {
      throw new HttpError(400, "courseId is required");
    }
    // Admin bypass mirrors the existing semantics in student/course/[courseId]
    // and the Phase 1 requireStudent/requireTeacher helpers.
    if (user.role === "admin") return;
    const enrolled = await deps.isEnrolled(user.uid, courseId);
    if (!enrolled) throw new AuthError("FORBIDDEN", "Not enrolled");
  };
}

/** Extracts the raw credential from a request. Returns null when absent. */
export function extractCredential(
  req: Request
): { kind: "token" | "cookie"; value: string } | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const value = authHeader.slice(7).trim();
    if (value) return { kind: "token", value };
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name !== SESSION_COOKIE_NAME) continue;
      const value = part.slice(eq + 1).trim();
      if (value) return { kind: "cookie", value };
    }
  }

  return null;
}

function normalizeRole(value: string | null | undefined): Role {
  return value === "admin" || value === "teacher" ? value : "student";
}

export interface AuthService {
  /** Resolves the caller, or null when no valid credential is present. */
  getSession(req: Request): Promise<AuthUser | null>;
  /** Resolves the caller or throws AuthError(401). */
  requireAuth(req: Request): Promise<AuthUser>;
  /** Requires one of the given roles; throws 401/403. */
  requireRole(req: Request, roles: Role | readonly Role[]): Promise<AuthUser>;
  requireAdmin(req: Request): Promise<AuthUser>;
  requireTeacher(req: Request): Promise<AuthUser>;
  requireStudent(req: Request): Promise<AuthUser>;
  /**
   * Requires the caller to be the owner of a resource (by firebase uid) or an
   * admin. Use this instead of trusting a uid supplied by the client.
   */
  requireSelfOrAdmin(req: Request, ownerUid: string): Promise<AuthUser>;
}

export function createAuthService(deps: AuthDeps): AuthService {
  async function getSession(req: Request): Promise<AuthUser | null> {
    const credential = extractCredential(req);
    if (!credential) return null;

    let verified: VerifiedCredential;
    try {
      verified =
        credential.kind === "cookie"
          ? await deps.verifySessionCookie(credential.value)
          : await deps.verifyIdToken(credential.value);
    } catch {
      return null;
    }

    if (!verified?.uid) return null;

    const profile = await deps.findProfileByFirebaseUid(verified.uid);
    if (!profile) return null;

    const accountRole = normalizeRole(profile.role);
    const accountStatus = typeof profile.status === "string" ? profile.status : null;
    return {
      uid: verified.uid,
      profileId: profile.id,
      role: sessionRoleFor(accountRole, accountStatus),
      email: profile.email ?? verified.email ?? null,
      accountRole,
      accountStatus,
    };
  }

  async function requireAuth(req: Request): Promise<AuthUser> {
    const user = await getSession(req);
    if (!user) throw new AuthError("UNAUTHORIZED");
    return user;
  }

  async function requireRole(
    req: Request,
    roles: Role | readonly Role[]
  ): Promise<AuthUser> {
    const user = await requireAuth(req);
    const allowed: readonly SessionRole[] = typeof roles === "string" ? [roles] : roles;
    // An applicant session is never one of the allowed roles, so it passes no role guard.
    if (!allowed.includes(user.role)) throw new AuthError("FORBIDDEN");
    return user;
  }

  return {
    getSession,
    requireAuth,
    requireRole,
    requireAdmin: (req) => requireRole(req, "admin"),
    requireTeacher: (req) => requireRole(req, ["teacher", "admin"]),
    requireStudent: (req) => requireRole(req, ["student", "admin"]),
    async requireSelfOrAdmin(req, ownerUid) {
      const user = await requireAuth(req);
      if (user.role !== "admin" && user.uid !== ownerUid) {
        throw new AuthError("FORBIDDEN");
      }
      return user;
    },
  };
}
