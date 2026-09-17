import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["change_status"] as const;

export const PATCH = withApi<{ runId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { runId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const run = await productionService.changeRunStatus(user, runId, {
    to: body.to,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: run }, { headers: PRIVATE_NO_STORE });
});
