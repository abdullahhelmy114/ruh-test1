import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { adminService } from "@/lib/academy/server";

// Curriculum, lesson script and assessment versions waiting for review.
export const GET = withApi(async (req) => {
  const user = await requireAdmin(req);
  return NextResponse.json({ data: await adminService.reviewQueue(user) }, { headers: PRIVATE_NO_STORE });
});
