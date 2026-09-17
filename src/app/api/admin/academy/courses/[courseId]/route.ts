import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { catalogService } from "@/lib/academy/server";

const ACTIONS = ["update", "change_status", "move_program", "delete", "restore"] as const;

export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  return NextResponse.json({ data: await catalogService.getCourse(user, courseId) }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  const common = { expectedRevision: body.expectedRevision, correlationId };
  switch (action) {
    case "update":
      return NextResponse.json({
        data: await catalogService.updateCourse(user, courseId, { ...common, title: body.title, description: body.description }),
      }, { headers: PRIVATE_NO_STORE });
    case "change_status":
      return NextResponse.json({
        data: await catalogService.changeCourseStatus(user, courseId, { ...common, to: body.to, reason: body.reason }),
      }, { headers: PRIVATE_NO_STORE });
    case "move_program":
      return NextResponse.json({
        data: await catalogService.moveCourse(user, courseId, { ...common, programId: body.programId, reason: body.reason }),
      }, { headers: PRIVATE_NO_STORE });
    case "delete":
      return NextResponse.json({ data: await catalogService.deleteCourse(user, courseId, { ...common, reason: body.reason }) }, { headers: PRIVATE_NO_STORE });
    case "restore":
      return NextResponse.json({ data: await catalogService.restoreCourse(user, courseId, { ...common, reason: body.reason }) }, { headers: PRIVATE_NO_STORE });
  }
});
