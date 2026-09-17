import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { readBooleanParam, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { deliveryService } from "@/lib/academy/server";

// Class groups (deliveries of a course), administration.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const classGroups = await deliveryService.listClassGroups(user, {
    courseId: readStringParam(req, "courseId"),
    includeDeleted: readBooleanParam(req, "includeDeleted"),
  });
  return NextResponse.json({ data: classGroups });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const classGroup = await deliveryService.createClassGroup(user, {
    courseId: body.courseId,
    curriculumVersionId: body.curriculumVersionId,
    name: body.name,
    capacity: body.capacity,
    startsOn: body.startsOn,
    endsOn: body.endsOn,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: classGroup }, { status: 201 });
});
