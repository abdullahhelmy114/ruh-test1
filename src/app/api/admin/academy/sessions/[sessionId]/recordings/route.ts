import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { recordingService } from "@/lib/academy/server";

// Adds a recording to a session that has taken place (starts in processing).
export const POST = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { sessionId } = await ctx.params;
  const body = await readJsonObject(req);
  const recording = await recordingService.createRecording(user, sessionId, {
    title: body.title,
    mediaUrl: body.mediaUrl,
    durationSeconds: body.durationSeconds,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: recording }, { status: 201, headers: PRIVATE_NO_STORE });
});
