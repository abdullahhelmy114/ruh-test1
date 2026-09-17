import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { assessmentService } from "@/lib/academy/server";

// Learners receive the assessment without answer keys once it opens; graders receive the full content.
export const GET = withApi<{ assignmentId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { assignmentId } = await ctx.params;
  return NextResponse.json({ data: await assessmentService.getAssignment(user, assignmentId) }, { headers: PRIVATE_NO_STORE });
});
