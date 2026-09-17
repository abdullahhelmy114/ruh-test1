import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { PRIVATE_NO_STORE } from "@/lib/academy/http";
import { communicationService } from "@/lib/academy/server";

// Academy-wide announcements for any signed-in member.
export const GET = withApi(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ data: await communicationService.listAcademyAnnouncements(user) }, { headers: PRIVATE_NO_STORE });
});
