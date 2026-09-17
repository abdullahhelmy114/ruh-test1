import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { assessmentAuthoringService } from "@/lib/academy/server";

// Assessments (administrative authoring). ?courseId= filters by course.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await assessmentAuthoringService.listAssessments(user, { courseId: readStringParam(req, "courseId") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const assessment = await assessmentAuthoringService.createAssessment(user, {
    courseId: body.courseId,
    mode: body.mode,
    title: body.title,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: assessment }, { status: 201, headers: PRIVATE_NO_STORE });
});
