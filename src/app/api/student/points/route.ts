// app/api/student/points/route.ts
// جلب رصيد النقاط وسجل الحركات للطالب

import { NextResponse } from "next/server";
import { getPointsBalance, getPointsHistory } from "@/lib/gamification/points";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: caller identity from the central auth layer; data is always the
// caller's own (profileId).
export const GET = withApi(async (request) => {
  const user = await requireAuth(request);

  try {
    const balance = await getPointsBalance(user.profileId);
    const history = await getPointsHistory(user.profileId, 20);
    return NextResponse.json({ balance, history });
  } catch (error) {
    console.error("Error fetching points:", error);
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
  }
});
