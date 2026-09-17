import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { productionService } from "@/lib/academy/server";

// Production status: items by kind, runs by state, reviews and rights waiting, open remediation.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await productionService.productionReport(user) }, { headers: PRIVATE_NO_STORE });
});
