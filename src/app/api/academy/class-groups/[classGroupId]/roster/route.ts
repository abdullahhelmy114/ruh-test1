import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { participationService } from "@/lib/academy/server";

// Learners of a class group (display names only) for its assigned teachers and administrators.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await participationService.roster(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
