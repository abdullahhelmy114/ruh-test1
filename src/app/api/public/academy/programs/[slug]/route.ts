import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { PUBLIC_SHORT_CACHE, rateLimitHeaders } from "@/lib/academy/http";
import { publicService } from "@/lib/academy/server";
import { checkRateLimit, clientKey, retryAfterSeconds } from "@/lib/security/rate-limit";

// Public program page data: the program and its active courses.
const LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

export const GET = withApi<{ slug: string }>(async (req, ctx) => {
  const check = checkRateLimit(`public-program:${clientKey(req)}`, LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  const { slug } = await ctx.params;
  return NextResponse.json({ data: await publicService.program(slug) }, { headers: PUBLIC_SHORT_CACHE });
});
