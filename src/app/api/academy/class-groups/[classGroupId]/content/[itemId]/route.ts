import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readJsonObject } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Learners receive content without answer keys; teachers of the class group and administrators see it in full.
export const GET = withApi<{ classGroupId: string; itemId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId, itemId } = await ctx.params;
  return NextResponse.json({ data: await practiceService.openContent(user, classGroupId, itemId) }, { headers: PRIVATE_NO_STORE });
});

// A learner submits answers to an activity or game; the server grades them.
export const POST = withApi<{ classGroupId: string; itemId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId, itemId } = await ctx.params;
  const body = await readJsonObject(req);
  const result = await practiceService.submitPractice(user, classGroupId, itemId, { responses: body.responses, durationSeconds: body.durationSeconds });
  return NextResponse.json({ data: result }, { status: 201, headers: PRIVATE_NO_STORE });
});
