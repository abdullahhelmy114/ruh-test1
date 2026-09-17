import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readStringParam } from "@/lib/academy/http";
import { practiceService } from "@/lib/academy/server";

// Learners: their own practice results. Teachers and administrators: ?learnerUid= names the TARGET learner.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  const data = await practiceService.practiceResults(user, classGroupId, { learnerUid: readStringParam(req, "learnerUid") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});
