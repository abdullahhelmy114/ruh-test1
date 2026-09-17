import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readBooleanParam, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { libraryService } from "@/lib/academy/server";

// Library books linked to a course as required or recommended reading.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const data = await libraryService.listCourseResources(user, courseId, { includeRemoved: readBooleanParam(req, "includeRemoved") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const body = await readJsonObject(req);
  const resource = await libraryService.addCourseResource(user, courseId, {
    libraryBookId: body.libraryBookId,
    lessonId: body.lessonId,
    purpose: body.purpose,
    pagesFrom: body.pagesFrom,
    pagesTo: body.pagesTo,
    note: body.note,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: resource }, { status: 201, headers: PRIVATE_NO_STORE });
});
