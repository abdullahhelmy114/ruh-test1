import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readJsonObject } from "@/lib/academy/http";
import { lessonSheetService } from "@/lib/academy/server";

// The calling teacher's own preparation for a session they teach. Opens when
// the session's Lesson Sheet is released.
export const GET = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { sessionId } = await ctx.params;
  return NextResponse.json({ data: await lessonSheetService.getPreparation(user, sessionId) }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { sessionId } = await ctx.params;
  const body = await readJsonObject(req);
  const preparation = await lessonSheetService.updatePreparation(user, sessionId, {
    status: body.status,
    privateNotes: body.privateNotes,
    expectedRevision: body.expectedRevision,
  });
  return NextResponse.json({ data: preparation }, { headers: PRIVATE_NO_STORE });
});
