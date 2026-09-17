import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readJsonObject } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

const ACTIONS = ["mark_read"] as const;

// Marks one of the caller's own notifications as read.
export const PATCH = withApi<{ notificationId: string }>(async (req, ctx) => {
  const user = await requireAuth(req);
  const { notificationId } = await ctx.params;
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  return NextResponse.json({ data: await communicationService.markNotificationRead(user, notificationId) }, { headers: PRIVATE_NO_STORE });
});
