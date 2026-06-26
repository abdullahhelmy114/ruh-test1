import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getServerSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await req.json(); // "monthly" or "lifetime"

  let expiresAt: Date;
  const now = new Date();

  if (plan === "monthly") {
    expiresAt = new Date(now.setMonth(now.getMonth() + 1));
  } else if (plan === "lifetime") {
    expiresAt = new Date(now.setFullYear(now.getFullYear() + 100)); // 100 سنة
  } else {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // نحذف أي وصول قديم ثم ندرج الجديد
  await sql`
    DELETE FROM library_access WHERE user_id = ${session.uid}
  `;

  await sql`
    INSERT INTO library_access (user_id, book_id, expires_at)
    VALUES (${session.uid}, NULL, ${expiresAt.toISOString()})
  `;

  return NextResponse.json({ success: true });
}