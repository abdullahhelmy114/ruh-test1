import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { PUBLIC_SHORT_CACHE, rateLimitHeaders } from "@/lib/academy/http";
import { publicService } from "@/lib/academy/server";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";

// Public catalog: active programs and courses. No sign-in; the client network
// key is only used to slow down scraping, never to identify anyone.
const LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

export const GET = withApi(async (req) => {
  const check = checkRateLimit(`public-catalog:${clientKey(req)}`, LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  return NextResponse.json({ data: await publicService.catalog() }, { headers: PUBLIC_SHORT_CACHE });
});
