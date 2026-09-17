import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject, readStringParam } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Content items (?libraryId&runId). Creating an item opens its first draft.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const data = await productionService.listItems(user, { libraryId: readStringParam(req, "libraryId"), runId: readStringParam(req, "runId") });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const created = await productionService.createItem(user, {
    libraryId: body.libraryId,
    runId: body.runId,
    kind: body.kind,
    title: body.title,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: created }, { status: 201, headers: PRIVATE_NO_STORE });
});
