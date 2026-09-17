import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { sql } from "@/lib/db/client";
import { checkRateLimit, clientKey, normalizeEmail, retryAfterSeconds } from "@/lib/security/rate-limit";

// Launch reinforcement: this public form had no abuse control, created its
// table on every request (DDL at request time) and told anyone whether an
// email address was already on the list. Now: a per-client limit, a
// normalized email, no schema changes from a request, and the same answer
// whether or not the address was already listed. Errors are generic.
const IP_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }; // 5 sign-ups / 15 min per client

export const POST = withApi(async (req) => {
  const check = checkRateLimit(`waitlist:${clientKey(req)}`, IP_LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(check)) } });
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalizeEmail(body?.email);
  if (!email) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  await sql`INSERT INTO waitlist (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
  return NextResponse.json({ message: "Successfully joined the waitlist" }, { status: 200 });
});
