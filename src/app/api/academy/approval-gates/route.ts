import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { governanceService } from "@/lib/academy/server";

// Open approval requests the caller may decide (administrators, and teachers where a gate allows them).
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await governanceService.listOpenGates(user) }, { headers: PRIVATE_NO_STORE });
});
