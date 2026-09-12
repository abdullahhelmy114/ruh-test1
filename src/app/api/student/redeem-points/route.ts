// app/api/student/redeem-points/route.ts
// استبدال النقاط بكوبون خصم

import { NextResponse } from "next/server";
import { redeemPointsForCoupon, getActiveRedemptionOffers } from "@/lib/gamification/redemption";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";

// User-facing business errors thrown by src/lib/gamification/redemption.ts.
// Only these reach the client verbatim; anything else is a server failure.
const REDEMPTION_USER_ERRORS = new Set([
  "Redemption offer not found",
  "Redemption offer is not active",
  "Insufficient points balance",
  "Failed to deduct points",
]);

// Phase 2.4a: caller identity from the central auth layer; redemption is
// always against the caller's own balance. Business behaviour unchanged.
// REVIEW (Phase 4): the deduction and coupon insert run on separate
// connections inside the redemption lib; making them one transaction is a
// data-layer change.
export const GET = withApi(async (request) => {
  await requireAuth(request);

  try {
    const offers = await getActiveRedemptionOffers();
    return NextResponse.json({ offers });
  } catch (error) {
    console.error("Error fetching redemption offers:", error);
    return NextResponse.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
});

export const POST = withApi(async (request) => {
  const user = await requireAuth(request);

  try {
    const body = await request.json();
    const { offerId } = body;

    if (!offerId) {
      return NextResponse.json({ error: "offerId is required" }, { status: 400 });
    }

    const coupon = await redeemPointsForCoupon(user.profileId, offerId);
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Error redeeming points:", error);
    const thrown = error instanceof Error ? error : null;
    if (thrown && REDEMPTION_USER_ERRORS.has(thrown.message)) {
      return NextResponse.json({ error: thrown.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to redeem points" }, { status: 500 });
  }
});
