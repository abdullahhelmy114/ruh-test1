import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Content libraries (academy-wide, program or course).
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await productionService.listLibraries(user) }, { headers: PRIVATE_NO_STORE });
});

export const POST = withApi(async (req) => {
  const user = await requireAdmin(req);
  const body = await readJsonObject(req);
  const library = await productionService.createLibrary(user, {
    slug: body.slug,
    title: body.title,
    description: body.description,
    scope: body.scope,
    programId: body.programId,
    courseId: body.courseId,
    correlationId: readCorrelationId(req),
  });
  return NextResponse.json({ data: library }, { status: 201, headers: PRIVATE_NO_STORE });
});
