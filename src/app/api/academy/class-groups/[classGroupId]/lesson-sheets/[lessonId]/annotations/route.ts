import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readJsonObject } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

// Creates a private annotation owned by the caller on a released Lesson Sheet.
export const POST = withApi<{ classGroupId: string; lessonId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId, lessonId } = await ctx.params;
  const body = await readJsonObject(req);
  const annotation = await lessonSheetService.createAnnotation(user, classGroupId, lessonId, {
    blockId: body.blockId,
    range: body.range,
    kind: body.kind,
    color: body.color,
    body: body.body,
  });
  return NextResponse.json({ data: annotation }, { status: 201, headers: PRIVATE_NO_STORE });
});
