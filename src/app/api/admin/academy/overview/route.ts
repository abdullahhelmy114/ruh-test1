import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { adminService } from "@/lib/academy/server";

// Operational overview: what needs administrative attention.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await adminService.overview(user) }, { headers: PRIVATE_NO_STORE });
});
