import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { readBooleanParam, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { catalogService } from "@/lib/academy/server";

// Academy courses (administration). A course is created with its curriculum.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const courses = await catalogService.listCourses(user, {
    programId: readStringParam(req, "programId"),
    includeDeleted: readBooleanParam(req, "includeDeleted"),
  });
  return NextResponse.json({ data: courses });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const created = await catalogService.createCourse(user, {
    programId: body.programId,
    catalogCourseId: body.catalogCourseId,
    slug: body.slug,
    title: body.title,
    description: body.description,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: created }, { status: 201 });
});
