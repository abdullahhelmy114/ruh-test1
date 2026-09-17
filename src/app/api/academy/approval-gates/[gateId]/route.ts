import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { governanceService } from "@/lib/academy/server";

export const GET = withApi<{ gateId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { gateId } = await ctx.params;
  return NextResponse.json({ data: await governanceService.getGate(user, gateId) }, { headers: PRIVATE_NO_STORE });
});

// Records the caller's decision ({ decision: "approve" | "reject" | "request_changes", reason? }).
// Eligibility, self-approval and one-decision-per-person rules are enforced by the service.
export const POST = withApi<{ gateId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { gateId } = await ctx.params;
  const body = await readJsonObject(req);
  const result = await governanceService.decide(user, gateId, { decision: body.decision, reason: body.reason, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: result }, { status: 201, headers: PRIVATE_NO_STORE });
});
