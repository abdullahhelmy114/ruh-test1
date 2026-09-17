import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Learners: their own remediation. Teachers and administrators: ?learnerUid= names the TARGET learner.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  const data = await practiceService.remediation(user, classGroupId, { learnerUid: readStringParam(req, "learnerUid") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

// A teacher of the class group assigns linked remediation to one TARGET learner (never the caller's identity).
export const POST = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const assignment = await practiceService.assignRemediation(user, classGroupId, {
    learnerUid: body.targetLearnerUid,
    itemId: body.itemId,
    note: body.note,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: assignment }, { status: 201, headers: PRIVATE_NO_STORE });
});
