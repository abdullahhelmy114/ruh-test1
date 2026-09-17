import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { certificateService } from "@/lib/academy/server";

const ACTIONS = ["revoke"] as const;

export const PATCH = withApi<{ certificateId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { certificateId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const certificate = await certificateService.revoke(user, certificateId, { reason: body.reason, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: certificate }, { headers: PRIVATE_NO_STORE });
});
