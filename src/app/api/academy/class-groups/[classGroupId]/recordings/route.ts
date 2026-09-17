import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { recordingService } from "@/lib/academy/server";

// Recordings of a class group. Media links appear only where watching is allowed.
export const GET = withApi<{ classGroupId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { classGroupId } = await ctx.params;
  return NextResponse.json({ data: await recordingService.listClassGroupRecordings(user, classGroupId) }, { headers: PRIVATE_NO_STORE });
});
