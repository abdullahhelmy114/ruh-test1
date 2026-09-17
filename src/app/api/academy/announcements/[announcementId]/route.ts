import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

const ACTIONS = ["withdraw"] as const;

// Withdraws an announcement (its author or an administrator).
export const PATCH = withApi<{ announcementId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { announcementId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const announcement = await communicationService.withdrawAnnouncement(user, announcementId, {
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: announcement }, { headers: PRIVATE_NO_STORE });
});
