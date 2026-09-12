// app/api/student/badges/route.ts
// جلب شارات الطالب الحالية

import { NextResponse } from "next/server";
import { getUserBadges, checkAndAwardBadges } from "@/lib/gamification/badges";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: caller identity from the central auth layer; badges are always
// evaluated and returned for the caller's own profile.
export const GET = withApi(async (request) => {
  const user = await requireAuth(request);

  try {
    await checkAndAwardBadges(user.profileId);
    const badges = await getUserBadges(user.profileId);
    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
});
