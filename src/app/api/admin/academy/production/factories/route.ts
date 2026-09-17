import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Registered production recipes. A factory records how content is produced; it executes nothing.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await productionService.listFactories(user) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const factory = await productionService.registerFactory(user, {
    key: body.key,
    title: body.title,
    description: body.description,
    outputKind: body.outputKind,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: factory }, { status: 201, headers: PRIVATE_NO_STORE });
});
