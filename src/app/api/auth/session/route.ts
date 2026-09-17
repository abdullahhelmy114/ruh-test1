import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sql } from "@/lib/db/client";
import { accountHome } from "@/lib/auth/home";

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
      expiresIn: 1000 * 60 * 60 * 24 * 14,
    });

    const [profile] = await sql`SELECT role, status FROM profiles WHERE firebase_uid = ${decoded.uid}`;
    const role = profile?.role || "student";
    const status = typeof profile?.status === "string" ? profile.status : null;

    const response = NextResponse.json({ success: true, role, status, home: accountHome(role, status) });

    response.cookies.set("__session", sessionCookie, {
      maxAge: 60 * 60 * 24 * 14,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    // Token verification details stay on the server.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
