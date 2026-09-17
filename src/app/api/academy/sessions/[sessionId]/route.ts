import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { participationService } from "@/lib/academy/server";

// Start or complete a session ({ action: "start" | "complete", expectedRevision }).
export const PATCH = withApi<{ sessionId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { sessionId } = await ctx.params;
  const body = await readJsonObject(req);
  const session = await participationService.conductSession(user, sessionId, {
    action: body.action,
    expectedRevision: body.expectedRevision,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: session }, { headers: PRIVATE_NO_STORE });
});
