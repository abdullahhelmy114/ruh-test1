import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { participationService } from "@/lib/academy/server";

// The signed-in learner's class groups and upcoming sessions.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await participationService.myLearning(user) }, { headers: PRIVATE_NO_STORE });
});
