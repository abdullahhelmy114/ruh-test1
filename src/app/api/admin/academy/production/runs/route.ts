import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Production runs (?state= filters).
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await productionService.listRuns(user, { state: readStringParam(req, "state") }) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const run = await productionService.createRun(user, {
    factoryId: body.factoryId,
    libraryId: body.libraryId,
    title: body.title,
    brief: body.brief,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: run }, { status: 201, headers: PRIVATE_NO_STORE });
});
