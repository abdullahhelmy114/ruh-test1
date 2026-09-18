"use client";

import Link from "next/link";
import { useState } from "react";

export interface BuyButtonText {
  readonly buyPlace: string;
  readonly buyOpening: string;
  readonly buyFailed: string;
  readonly buySignIn: string;
  readonly buyLearnersOnly: string;
}

/**
 * Starts a Whop checkout for one offer. The server decides everything that
 * matters (learner, plan, metadata) and answers with the Whop checkout
 * address; this button only follows it. It never shows success itself: the
 * learner is enrolled after Whop's signed payment event, and the return page
 * reads that from the server.
 */
export function BuyButton({ offerId, disabled, text }: { readonly offerId: string; readonly disabled?: boolean; readonly text: BuyButtonText }) {
  const [state, setState] = useState<"idle" | "opening" | "failed" | "signIn" | "learnersOnly" | "refused">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function buy() {
    setState("opening");
    setMessage(null);
    try {
      const response = await fetch("/api/academy/checkouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ offerId }),
      });
      const body = (await response.json().catch(() => null)) as { data?: { purchaseUrl?: unknown }; error?: unknown } | null;
      const url = body?.data?.purchaseUrl;
      if (response.status === 201 && typeof url === "string" && url.startsWith("https://")) {
        window.location.assign(url);
        return;
      }
      if (response.status === 401) return setState("signIn");
      if (response.status === 403) return setState("learnersOnly");
      if (response.status === 409 || response.status === 404) {
        setMessage(typeof body?.error === "string" ? body.error : null);
        return setState("refused");
      }
      setState("failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={() => void buy()}
        disabled={disabled || state === "opening"}
        aria-busy={state === "opening"}
        className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {state === "opening" ? text.buyOpening : text.buyPlace}
      </button>
      <div role="status" aria-live="polite" className="text-sm">
        {state === "failed" && <p className="text-destructive">{text.buyFailed}</p>}
        {state === "signIn" && (
          <p>
            <Link href="/login" className="underline underline-offset-4">
              {text.buySignIn}
            </Link>
          </p>
        )}
        {state === "learnersOnly" && <p>{text.buyLearnersOnly}</p>}
        {state === "refused" && message && <p>{message}</p>}
      </div>
    </div>
  );
}
