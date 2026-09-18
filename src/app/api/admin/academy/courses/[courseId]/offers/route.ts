import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { commerceService } from "@/lib/academy/server";

// Offers of a course: each maps one Whop plan (plan_...) to one class group.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  return NextResponse.json({ data: await commerceService.listOffers(user, courseId) }, { headers: PRIVATE_NO_STORE });
});

// { classGroupId, planId, label }: the plan id is copied from the Whop dashboard; it is the offer's identity.
export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const body = await readJsonObject(req);
  const offer = await commerceService.createOffer(user, courseId, {
    classGroupId: body.classGroupId,
    planId: body.planId,
    label: body.label,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: offer }, { status: 201, headers: PRIVATE_NO_STORE });
});
