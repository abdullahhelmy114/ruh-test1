import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { certificateService } from "@/lib/academy/server";

// The signed-in learner's own certificates.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await certificateService.myCertificates(user) }, { headers: PRIVATE_NO_STORE });
});
