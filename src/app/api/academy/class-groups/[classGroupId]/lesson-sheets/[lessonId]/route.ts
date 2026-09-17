import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

// A Lesson Sheet with the caller's own annotations. The release rule and all
// access checks are enforced by the service on every request.
export const GET = withApi<{ classGroupId: string; lessonId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId, lessonId } = await ctx.params;
  return NextResponse.json({ data: await lessonSheetService.getSheet(user, classGroupId, lessonId) }, { headers: PRIVATE_NO_STORE });
});
