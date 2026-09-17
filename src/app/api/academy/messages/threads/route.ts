import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, rateLimitHeaders, readJsonObject } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";

const OPEN_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

// The caller's conversations.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await communicationService.listThreads(user) }, { headers: PRIVATE_NO_STORE });
});

// Opens (or returns) a conversation with a recipient the caller may message.
// recipientUid names the TARGET; the sender is always the signed-in caller.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);
  const check = checkRateLimit(`academy-thread-open:${user.uid}`, OPEN_LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  const body = await readJsonObject(req);
  const thread = await communicationService.openThread(user, { recipientUid: body.recipientUid, classGroupId: body.classGroupId });
  return NextResponse.json({ data: thread }, { status: 201, headers: PRIVATE_NO_STORE });
});
