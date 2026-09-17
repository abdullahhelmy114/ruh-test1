import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, rateLimitHeaders } from "@/lib/academy/http";
import { certificateService } from "@/lib/academy/server";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";

// Public certificate verification: valid, revoked or not found.
// No sign-in. The client network key is used only to slow down guessing,
// never to identify or authorise anyone. Responses are not cached, so a
// revocation shows immediately.
const VERIFY_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

export const GET = withApi<{ code: string }>(async (req, ctx) => {
  const check = checkRateLimit(`certificate-verify:${clientKey(req)}`, VERIFY_LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  const { code } = await ctx.params;
  return NextResponse.json({ data: await certificateService.verify(code) }, { headers: PRIVATE_NO_STORE });
});
