import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

const ACTIONS = ["update", "change_status", "repin_curriculum", "assign_teacher", "unassign_teacher", "delete", "restore"] as const;

export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await deliveryService.getClassGroup(user, classGroupId) });
});

export const PATCH = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { classGroupId } = await ctx.params;
  const body = await readJsonObject(req);
  const correlationId = readCorrelationId(req);
  const action = readAction(body, ACTIONS);
  const common = { expectedRevision: body.expectedRevision, correlationId };
  switch (action) {
    case "update":
      return NextResponse.json({
        data: await deliveryService.updateClassGroup(user, classGroupId, {
          ...common,
          name: body.name,
          capacity: body.capacity,
          startsOn: body.startsOn,
          endsOn: body.endsOn,
        }),
      });
    case "change_status":
      return NextResponse.json({
        data: await deliveryService.changeClassGroupStatus(user, classGroupId, { ...common, to: body.to, reason: body.reason }),
      });
    case "repin_curriculum":
      return NextResponse.json({
        data: await deliveryService.repinCurriculum(user, classGroupId, {
          ...common,
          curriculumVersionId: body.curriculumVersionId,
          reason: body.reason,
        }),
      });
    case "assign_teacher":
      return NextResponse.json(
        { data: await deliveryService.assignTeacher(user, classGroupId, { teacherUid: body.teacherUid, correlationId }) },
        { status: 201 },
      );
    case "unassign_teacher":
      return NextResponse.json({
        data: await deliveryService.unassignTeacher(user, classGroupId, {
          assignmentId: body.assignmentId,
          reason: body.reason,
          correlationId,
        }),
      });
    case "delete":
      return NextResponse.json({ data: await deliveryService.deleteClassGroup(user, classGroupId, { ...common, reason: body.reason }) });
    case "restore":
      return NextResponse.json({ data: await deliveryService.restoreClassGroup(user, classGroupId, { ...common, reason: body.reason }) });
  }
});
