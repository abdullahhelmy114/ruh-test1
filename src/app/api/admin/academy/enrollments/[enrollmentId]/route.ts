import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

const ACTIONS = ["change_status"] as const;

export const PATCH = withApi<{ enrollmentId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { enrollmentId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const enrollment = await deliveryService.changeEnrollmentStatus(user, enrollmentId, {
    to: body.to,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: enrollment });
});
