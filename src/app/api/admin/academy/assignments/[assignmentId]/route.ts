import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

const ACTIONS = ["cancel"] as const;

export const PATCH = withApi<{ assignmentId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { assignmentId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const assignment = await assessmentService.cancelAssignment(user, assignmentId, {
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: assignment }, { headers: PRIVATE_NO_STORE });
});
