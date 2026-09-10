import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

/**
 * Whop webhook receiver — Phase 0 containment.
 *
 * Signature scheme (per docs.whop.com/webhooks): HMAC-SHA256 with the `ws_...`
 * webhook secret over `${webhook-id}.${webhook-timestamp}.${rawBody}`, sent
 * base64-encoded in the `webhook-signature` header as `v1,<signature>`
 * (possibly several space-separated entries). Delivery is at-least-once.
 *
 * This version only verifies and acknowledges. Event processing, idempotency
 * (webhook_events table) and entitlement sync are implemented in Phase 3.
 */

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function verifyWhopSignature(
  secret: string,
  id: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  const candidates = signatureHeader
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("v1,") ? s.slice(3) : s));

  for (const candidate of candidates) {
    let provided: Buffer;
    try {
      provided = Buffer.from(candidate, "base64");
    } catch {
      continue;
    }
    if (
      provided.length === expected.length &&
      crypto.timingSafeEqual(provided, expected)
    ) {
      return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("WHOP_WEBHOOK_SECRET is not configured; refusing webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  try {
    const rawBody = await req.text();
    const id = req.headers.get("webhook-id") || "";
    const timestamp = req.headers.get("webhook-timestamp") || "";
    const signature = req.headers.get("webhook-signature") || "";

    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_TIMESTAMP_SKEW_SECONDS) {
      return NextResponse.json({ error: "Stale timestamp" }, { status: 401 });
    }

    if (!verifyWhopSignature(secret, id, timestamp, rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event: { type?: string } = {};
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Phase 3 will persist and process events here. Acknowledge for now so
    // Whop does not retry indefinitely; nothing is granted on this path yet.
    console.log(`Whop webhook received (unprocessed): ${event.type ?? "unknown"} [${id}]`);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Whop webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
