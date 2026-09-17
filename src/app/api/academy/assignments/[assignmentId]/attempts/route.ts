import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

// Starts an attempt (or a revision) for the signed-in learner.
export const POST = withApi<{ assignmentId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { assignmentId } = await ctx.params;
  return NextResponse.json({ data: await assessmentService.startAttempt(user, assignmentId) }, { status: 201, headers: PRIVATE_NO_STORE });
});
