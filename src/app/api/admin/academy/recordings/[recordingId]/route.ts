import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { recordingService } from "@/lib/academy/server";

const ACTIONS = ["change_status"] as const;

export const PATCH = withApi<{ recordingId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { recordingId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const recording = await recordingService.changeRecordingStatus(user, recordingId, {
    to: body.to,
    reason: body.reason,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: recording }, { headers: PRIVATE_NO_STORE });
});
