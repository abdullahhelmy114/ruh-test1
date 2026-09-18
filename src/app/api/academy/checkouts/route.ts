import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, rateLimitHeaders, readCorrelationId, readJsonObject } from "@/lib/academy/http";
import { commerceService } from "@/lib/academy/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/security/rate-limit";

const OPEN_LIMIT = { limit: 10, windowMs: 10 * 60 * 1000 };

// Opens a Whop checkout for the signed-in learner and one offer ({ offerId }).
// The learner, the offer's plan and the metadata Whop copies onto the payment
// are decided here on the server; the response only says where to go next.
// Nothing is granted by this call: access follows the signed payment event.
export const POST = withApi(async (req) => {
  const user = await requireAuth(req);
  const check = checkRateLimit(`academy-checkout-open:${user.uid}`, OPEN_LIMIT);
  if (!check.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(retryAfterSeconds(check)) });
  }
  const body = await readJsonObject(req);
  const opened = await commerceService.startCheckout(user, { offerId: body.offerId, correlationId: readCorrelationId(req) });
  return NextResponse.json({ data: opened }, { status: 201, headers: PRIVATE_NO_STORE });
});
