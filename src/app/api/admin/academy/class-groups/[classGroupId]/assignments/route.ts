import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

// Assigns the published version of an assessment to a class group.
export const POST = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const assignment = await assessmentService.createAssignment(user, classGroupId, {
    assessmentId: body.assessmentId,
    opensAt: body.opensAt,
    dueAt: body.dueAt,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: assignment }, { status: 201, headers: PRIVATE_NO_STORE });
});
