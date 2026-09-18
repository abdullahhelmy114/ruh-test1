import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { commerceService } from "@/lib/academy/server";

// The state of the caller's own checkout (pending, completed, failed) and of the
// access it bought, read from the server's records only. Another learner's
// checkout answers exactly like a missing one.
export const GET = withApi<{ checkoutId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { checkoutId } = await ctx.params;
  return NextResponse.json({ data: await commerceService.checkoutStatus(user, checkoutId) }, { headers: PRIVATE_NO_STORE });
});
