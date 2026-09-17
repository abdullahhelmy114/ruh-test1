import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { progressService } from "@/lib/academy/server";

const ACTIONS = ["revoke"] as const;

export const PATCH = withApi<{ completionId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { completionId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const completion = await progressService.revokeCompletion(user, completionId, { reason: body.reason, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: completion }, { headers: PRIVATE_NO_STORE });
});
