// app/api/student/streak/route.ts
// جلب أو تحديث سلسلة الأيام المتتالية (Streak) للطالب

import { NextResponse } from "next/server";
import { getStreak, updateStreak } from "@/lib/gamification/streaks";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// Phase 2.4a: caller identity from the central auth layer (profileId ==
// profiles.id used by the gamification tables). Same-day repeat calls no
// longer award points (see gamification/streak-rules.ts).
export const GET = withApi(async (request) => {
  const user = await requireAuth(request);

  try {
    const streak = await getStreak(user.profileId);
    return NextResponse.json({ streak });
  } catch (error) {
    console.error("Error fetching streak:", error);
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
});

export const POST = withApi(async (request) => {
  const user = await requireAuth(request);

  try {
    const streak = await updateStreak(user.profileId);
    return NextResponse.json({ success: true, streak });
  } catch (error) {
    console.error("Error updating streak:", error);
    return NextResponse.json({ error: "Failed to update streak" }, { status: 500 });
  }
});
