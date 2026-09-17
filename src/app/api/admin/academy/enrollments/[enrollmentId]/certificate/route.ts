import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId } from "@/lib/academy/http";
import { certificateService } from "@/lib/academy/server";

// Certificate eligibility for an enrollment under the course's rules.
export const GET = withApi<{ enrollmentId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { enrollmentId } = await ctx.params;
  return NextResponse.json({ data: await certificateService.eligibility(user, enrollmentId) }, { headers: PRIVATE_NO_STORE });
});

// Issues the certificate when the enrollment is eligible.
export const POST = withApi<{ enrollmentId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { enrollmentId } = await ctx.params;
  const certificate = await certificateService.issue(user, enrollmentId, { correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: certificate }, { status: 201, headers: PRIVATE_NO_STORE });
});
