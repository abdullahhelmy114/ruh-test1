import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE, readAction, readBooleanParam, readJsonObject, readStringParam } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

const ACTIONS = ["mark_all_read"] as const;

// The caller's own notifications (?unreadOnly=true, ?before=).
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  const data = await communicationService.listNotifications(user, {
    unreadOnly: readBooleanParam(req, "unreadOnly"),
    before: readStringParam(req, "before"),
  });
  return NextResponse.json({ data }, { headers: PRIVATE_NO_STORE });
});

export const PATCH = withApi(async (req) => {
  const user = await requireAuth(req);
  const body = await readJsonObject(req);
  readAction(body, ACTIONS);
  return NextResponse.json({ data: await communicationService.markAllNotificationsRead(user) }, { headers: PRIVATE_NO_STORE });
});
