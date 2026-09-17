import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

const ACTIONS = ["create_draft"] as const;

export const GET = withApi<{ itemId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { itemId } = await ctx.params;
  return NextResponse.json({ data: await productionService.getItem(user, itemId) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi<{ itemId: string }>(async (req, ctx) => {
  const user = await requireAdmin(req);
  const { itemId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  const version = await productionService.createDraft(user, itemId, { basedOnVersionId: body.basedOnVersionId, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: version }, { status: 201, headers: PRIVATE_NO_STORE });
});
