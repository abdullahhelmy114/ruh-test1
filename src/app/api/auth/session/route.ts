import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { accountHome } from "@/lib/auth/home";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
// Set and cleared with the same attributes, or the browser keeps the original.
const SESSION_COOKIE = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

// Exchanges a verified Firebase ID token for the session cookie and tells the
// login page where the account lands. The destination follows the stored
// role AND status (a teacher account is sent to its application page until it
// is approved); it is navigation only, every page and API authorizes again.
export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });

    const [profile] = await sql`SELECT role, status FROM profiles WHERE firebase_uid = ${decoded.uid}`;
    const role = profile?.role || "student";
    const status = typeof profile?.status === "string" ? profile.status : null;

    const response = NextResponse.json({ success: true, role, status, home: accountHome(role, status) });

    response.cookies.set("__session", sessionCookie, { ...SESSION_COOKIE, maxAge: SESSION_MAX_AGE_SECONDS });

    return response;
  } catch {
    // Token verification details stay on the server.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Signing out. The session cookie is httpOnly, so the browser cannot drop it
// itself: without this, signing out of Firebase left the cookie in place and
// every page and API kept treating the browser as signed in for up to 14 days.
//
// Expiring the cookie is not enough on its own: a copy of it (another tab's
// saved state, a stolen value) would stay valid until it expired. Firebase
// session cookies cannot be revoked one by one, so signing out revokes the
// account's refresh tokens, and the session check (verifySessionCookie with
// checkRevoked) then refuses every cookie issued before now — this signs the
// account out on all its devices. Only the caller's own verified cookie can
// trigger it; the cookie is expired whether or not it was still valid.
export async function DELETE(request: NextRequest) {
  const cookie = request.cookies.get("__session")?.value;
  if (cookie) {
    try {
      const auth = getAdminAuth();
      const decoded = await auth.verifySessionCookie(cookie, true);
      await auth.revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid, expired or revoked: there is nothing left to end.
    }
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set("__session", "", { ...SESSION_COOKIE, maxAge: 0 });
  return response;
}
