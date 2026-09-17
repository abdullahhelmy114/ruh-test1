import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Applies the academy's remediation rules to a released result (graders of the class group).
export const POST = withApi<{ attemptId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { attemptId } = await ctx.params;
  const data = await practiceService.applyRemediationRules(user, attemptId, { correlationId: readCorrelationId(req) });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
