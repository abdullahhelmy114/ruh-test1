import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

// Announcements visible to a class group's participants.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await communicationService.listClassGroupAnnouncements(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});

// Publishes a class group announcement (assigned teachers and administrators).
export const POST = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const announcement = await communicationService.publishClassGroupAnnouncement(user, classGroupId, {
    title: body.title,
    body: body.body,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: announcement }, { status: 201, headers: PRIVATE_NO_STORE });
});
