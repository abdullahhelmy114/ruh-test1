import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

// Work waiting for the class group's teachers: submissions to grade and results to release.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await assessmentService.reviewQueue(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
