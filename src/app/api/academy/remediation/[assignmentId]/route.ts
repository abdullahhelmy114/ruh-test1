import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Learners mark their own remediation completed; teachers complete or dismiss (with a reason).
export const PATCH = withApi<{ assignmentId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { assignmentId } = await ctx.params;
  const body = await readJsonObject(req);
  const assignment = await practiceService.resolveRemediation(user, assignmentId, {
    to: body.to,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: assignment }, { headers: PRIVATE_NO_STORE });
});
