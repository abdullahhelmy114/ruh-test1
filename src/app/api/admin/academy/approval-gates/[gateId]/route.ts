import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { governanceService } from "@/lib/academy/server";

const ACTIONS = ["cancel"] as const;

export const PATCH = withApi<{ gateId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { gateId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const gate = await governanceService.cancel(user, gateId, { reason: body.reason, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: gate }, { headers: PRIVATE_NO_STORE });
});
