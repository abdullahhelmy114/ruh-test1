import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { recordingService } from "@/lib/academy/server";

export const GET = withApi<{ recordingId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { recordingId } = await ctx.params;
  return NextResponse.json({ data: await recordingService.getRecording(user, recordingId) }, { headers: PRIVATE_NO_STORE });
});
