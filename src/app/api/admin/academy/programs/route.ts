import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readBooleanParam, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { catalogService } from "@/lib/academy/server";

// Academy programs (administration). Identity comes only from the session.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  const programs = await catalogService.listPrograms(user, { includeDeleted: readBooleanParam(req, "includeDeleted") });
  return NextResponse.json({ data: programs }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const program = await catalogService.createProgram(user, {
    slug: body.slug,
    title: body.title,
    description: body.description,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: program }, { status: 201, headers: PRIVATE_NO_STORE });
});
