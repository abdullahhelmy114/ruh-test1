import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { commerceService } from "@/lib/academy/server";

const ACTIONS = ["retire"] as const;

// Stops selling an offer ({ action: "retire", reason, expectedRevision }). Access already bought is untouched.
export const PATCH = withApi<{ offerId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { offerId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const offer = await commerceService.retireOffer(user, offerId, { reason: body.reason, expectedRevision: body.expectedRevision, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: offer }, { headers: PRIVATE_NO_STORE });
});
