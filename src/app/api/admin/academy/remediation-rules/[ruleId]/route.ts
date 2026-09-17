import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["retire"] as const;

export const PATCH = withApi<{ ruleId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { ruleId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const rule = await productionService.retireRemediationRule(user, ruleId, { reason: body.reason, expectedRevision: body.expectedRevision, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: rule }, { headers: PRIVATE_NO_STORE });
});
