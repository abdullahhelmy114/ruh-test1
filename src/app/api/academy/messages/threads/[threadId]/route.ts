import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, rateLimitHeaders, readAction, readJsonObject, readStringParam } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";

const SEND_LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };
const ACTIONS = ["mark_read"] as const;

// Messages of one of the caller's conversations (?before= pages back).
export const GET = withApi<{ threadId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { threadId } = await ctx.params;
  const data = await communicationService.getThread(user, threadId, { before: readStringParam(req, "before") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

// Sends a message; permission is re-checked on every message.
export const POST = withApi<{ threadId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { threadId } = await ctx.params;
  const check = checkRateLimit(`academy-messages:${user.uid}`, SEND_LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  const body = await readJsonObject(req);
  const message = await communicationService.sendMessage(user, threadId, { body: body.body });
  return NextResponse.json({ data: message }, { status: 201, headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ threadId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { threadId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  return NextResponse.json({ data: await communicationService.markThreadRead(user, threadId) }, { headers: PRIVATE_NO_STORE });
});
