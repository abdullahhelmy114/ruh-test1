import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await deliveryService.listEnrollments(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});

// Administrative enrollment. The learner uid identifies the TARGET learner, never the caller.
export const POST = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const enrollment = await deliveryService.enroll(user, classGroupId, {
    learnerUid: body.learnerUid,
    activate: body.activate,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: enrollment }, { status: 201, headers: PRIVATE_NO_STORE });
});
