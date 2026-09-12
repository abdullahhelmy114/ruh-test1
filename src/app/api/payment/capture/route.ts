import { NextResponse } from "next/server";

// Phase 2.4a-1 containment: this endpoint recorded a "confirmed" purchase,
// enrolled the caller, and credited a referrer from a client-supplied amount
// with no payment-provider verification. Disabled. Entitlements will be
// granted only by verified Whop webhook events (Phase 3).
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been removed." },
    { status: 410 }
  );
}
