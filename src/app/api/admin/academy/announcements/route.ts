import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

// Academy-wide ({ scope: "academy" }) or course-wide ({ scope: "course", courseId }) announcements.
export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const announcement = await communicationService.publishAnnouncement(user, {
    scope: body.scope,
    courseId: body.courseId,
    title: body.title,
    body: body.body,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: announcement }, { status: 201, headers: PRIVATE_NO_STORE });
});
