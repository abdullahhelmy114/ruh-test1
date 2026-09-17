import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { curriculumService } from "@/lib/academy/server";

const ACTIONS = ["create_draft"] as const;

// The course's curriculum and its version history.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  return NextResponse.json({ data: await curriculumService.getCurriculum(user, courseId) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { courseId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const version = await curriculumService.createDraft(user, courseId, {
    basedOnVersionId: body.basedOnVersionId,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: version }, { status: 201, headers: PRIVATE_NO_STORE });
});
