import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Remediation rules for a course. Thresholds are explicit academy decisions; there are no defaults.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  return NextResponse.json({ data: await productionService.listRemediationRules(user, courseId) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const body = await readJsonObject(req);
  const rule = await productionService.createRemediationRule(user, courseId, {
    assessmentId: body.assessmentId,
    itemId: body.itemId,
    belowScorePercent: body.belowScorePercent,
    reason: body.reason,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: rule }, { status: 201, headers: PRIVATE_NO_STORE });
});
