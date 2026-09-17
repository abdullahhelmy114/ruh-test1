import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["remove"] as const;

export const PATCH = withApi<{ linkId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { linkId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const link = await productionService.removeLink(user, linkId, { reason: body.reason, expectedRevision: body.expectedRevision, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: link }, { headers: PRIVATE_NO_STORE });
});
