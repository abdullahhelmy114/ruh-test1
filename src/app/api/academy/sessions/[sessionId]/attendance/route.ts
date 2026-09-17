import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { attendanceService } from "@/lib/academy/server";

// Teachers and administrators see every mark; learners see only their own.
export const GET = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { sessionId } = await ctx.params;
  return NextResponse.json({ data: await attendanceService.sessionAttendance(user, sessionId) }, { headers: PRIVATE_NO_STORE });
});

// Records or corrects marks ({ marks: [{ learnerUid, code, reason?, expectedRevision? }] }).
export const PUT = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { sessionId } = await ctx.params;
  const body = await readJsonObject(req);
  const result = await attendanceService.recordAttendance(user, sessionId, { marks: body.marks, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: result }, { headers: PRIVATE_NO_STORE });
});
