import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Per-learner results report for the class group's teachers and administrators.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await practiceService.classGroupReport(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
