import { NextResponse } from "next/server";
import { readWhopEnvelope } from "@/lib/academy/commerce/commerce";
import { DomainError } from "@/lib/academy/domain/errors";
import { commerceService, whopConfig } from "@/lib/academy/server";
import { verifyWhopSignature } from "@/lib/payments/whop";

export const runtime = "nodejs";

/**
 * Whop webhook receiver: the only way academy access changes after a payment.
 *
 * 1. Fails closed (500) without WHOP_WEBHOOK_SECRET.
 * 2. Verifies the Standard Webhooks signature over the RAW body, and refuses
 *    deliveries more than five minutes from now (src/lib/payments/whop.ts).
 * 3. Processes the event once: the delivery id (`webhook-id`, kept by Whop
 *    across retries) is recorded with its effect in one transaction, so a
 *    redelivery changes nothing.
 *
 * Status codes decide Whop's retries: 2xx for processed, duplicate or
 * irrelevant events; 400/401 for requests that can never succeed; 5xx for
 * transient failures, which Whop retries. Logs carry the event type, the
 * delivery id and the outcome only — never the body, the signature or the
 * secret.
 */
export async function POST(req: Request) {
  const secret = whopConfig.webhookSecret;
  if (!secret) {
    console.error("WHOP_WEBHOOK_SECRET is not configured; refusing webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const id = req.headers.get("webhook-id");
  const check = verifyWhopSignature(
    secret,
    { id, timestamp: req.headers.get("webhook-timestamp"), signature: req.headers.get("webhook-signature") },
    rawBody,
    Math.floor(Date.now() / 1000),
  );
  if (check !== "valid") {
    console.warn(`Whop webhook refused: ${check} signature`);
    const message = check === "missing" ? "Missing signature headers" : check === "stale" ? "Stale timestamp" : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  let envelope;
  try {
    envelope = readWhopEnvelope(JSON.parse(rawBody));
  } catch {
    console.warn(`Whop webhook refused: malformed event [${id}]`);
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const result = await commerceService.handleWhopEvent(id as string, envelope);
    console.log(`Whop webhook ${envelope.type} [${id}]: ${result.outcome}`);
    return NextResponse.json({ received: true, outcome: result.outcome }, { status: 200 });
  } catch (error) {
    if (error instanceof DomainError && error.code === "VALIDATION") {
      console.warn(`Whop webhook ${envelope.type} [${id}] refused: ${error.message}`);
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    console.error(`Whop webhook ${envelope.type} [${id}] failed:`, error instanceof DomainError ? error.code : error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
