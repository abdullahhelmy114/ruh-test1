import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { governanceService } from "@/lib/academy/server";

// Approval gate configuration. There are no defaults: unconfigured gates cannot be opened.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await governanceService.listGateDefinitions(user) }, { headers: PRIVATE_NO_STORE });
});

export const PUT = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const definition = await governanceService.configureGate(user, {
    type: body.type,
    requiredApprovals: body.requiredApprovals,
    eligibleRoles: body.eligibleRoles,
    allowSelfApproval: body.allowSelfApproval,
    reason: body.reason,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: definition }, { headers: PRIVATE_NO_STORE });
});
