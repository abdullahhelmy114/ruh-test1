import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

// When each lesson's sheet becomes available for this class group (no content).
// Access: the class group's active learners, its assigned teachers, administrators.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await lessonSheetService.listAvailability(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
