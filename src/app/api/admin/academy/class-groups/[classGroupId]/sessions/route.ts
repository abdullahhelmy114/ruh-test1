import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await deliveryService.listSessions(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});

// Schedules one lesson of the class group's curriculum version at an absolute time.
export const POST = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const session = await deliveryService.scheduleSession(user, classGroupId, {
    lessonId: body.lessonId,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    meetingUrl: body.meetingUrl,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: session }, { status: 201, headers: PRIVATE_NO_STORE });
});
