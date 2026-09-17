import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { teacherService } from "@/lib/academy/server";

// Deactivate (reason required) or reactivate an approved teacher account, on the status the administrator saw.
export const PATCH = withApi<{ teacherUid: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { teacherUid } = await ctx.params;
  const body = await readJsonObject(req);
  const data = await teacherService.changeTeacherAccount(user, teacherUid, {
    command: body.command,
    reason: body.reason,
    expectedStatus: body.expectedStatus,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
