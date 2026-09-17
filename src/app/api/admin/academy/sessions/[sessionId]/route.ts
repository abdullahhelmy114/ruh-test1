import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

const ACTIONS = ["reschedule", "change_status"] as const;

export const PATCH = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { sessionId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  switch (action) {
    case "reschedule":
      return NextResponse.json({
        data: await deliveryService.rescheduleSession(user, sessionId, {
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          meetingUrl: body.meetingUrl,
          reason: body.reason,
          expectedRevision: body.expectedRevision,
          correlationId,
        }),
      }, { headers: PRIVATE_NO_STORE });
    case "change_status":
      return NextResponse.json({
        data: await deliveryService.changeSessionStatus(user, sessionId, {
          to: body.to,
          reason: body.reason,
          expectedRevision: body.expectedRevision,
          correlationId,
        }),
      }, { headers: PRIVATE_NO_STORE });
  }
});
