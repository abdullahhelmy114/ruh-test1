import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";

// One application: details, account facts and history (GET), and a decision on
// the revision the administrator saw (PATCH: start_review, schedule_interview,
// request_changes, approve, reject). Approval activates the teacher account in
// the same transaction.
export const GET = withApi<{ applicationId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { applicationId } = await ctx.params;
  return NextResponse.json({ data: await teacherService.getApplication(user, applicationId) }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ applicationId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { applicationId } = await ctx.params;
  const body = await readJsonObject(req);
  const data = await teacherService.decide(user, applicationId, {
    command: body.command,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
