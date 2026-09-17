import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { progressService } from "@/lib/academy/server";

// Records course completion for an enrollment. If the academy's completion
// criteria are not met, an overrideReason is required and audited.
export const POST = withApi<{ enrollmentId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { enrollmentId } = await ctx.params;
  const body = await readJsonObject(req);
  const result = await progressService.recordCompletion(user, enrollmentId, {
    overrideReason: body.overrideReason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: result }, { status: 201, headers: PRIVATE_NO_STORE });
});
