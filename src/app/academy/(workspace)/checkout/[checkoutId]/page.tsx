"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import { ApiView, LinkButton, Notice, PageHeader } from "@/components/academy/workspace/ui";
import type { CheckoutView } from "@/lib/academy/services/commerce-service";

// Where Whop sends the buyer back. Everything shown comes from the server's
// records: the page never assumes a payment succeeded because the browser
// arrived here. While Whop has not confirmed, it keeps asking.
const FAST_MS = 3_000;
const SLOW_MS = 10_000;
const FAST_POLLS = 20;

export default function CheckoutReturnPage() {
  const { checkoutId } = useParams<{ checkoutId: string }>();
  const { t } = useWorkspace();
  const { state, reload } = useApi<CheckoutView>(api.checkout(checkoutId));
  const polls = useRef(0);
  const [long, setLong] = useState(false);
  const pending = state.status === "ready" && (state.data.state === "created" || state.data.state === "open");

  useEffect(() => {
    if (!pending) return;
    const delay = polls.current < FAST_POLLS ? FAST_MS : SLOW_MS;
    const timer = setTimeout(() => {
      polls.current += 1;
      if (polls.current >= FAST_POLLS) setLong(true);
      reload();
    }, delay);
    return () => clearTimeout(timer);
  }, [pending, state, reload]);

  return (
    <ApiView state={state} onRetry={reload}>
      {(view) => (
        <>
          <PageHeader title={t.checkout.title} />
          <CheckoutMessage view={view} long={long} />
        </>
      )}
    </ApiView>
  );
}

function CheckoutMessage({ view, long }: { readonly view: CheckoutView; readonly long: boolean }) {
  const { t } = useWorkspace();
  if (view.entitlement?.state === "revoked") {
    return <Notice tone="warning">{view.entitlement.stateReason === "refunded" ? t.checkout.refunded : t.checkout.membershipEnded}</Notice>;
  }
  if (view.entitlement?.state === "active" && view.classGroupId) {
    return (
      <div className="space-y-3">
        <Notice tone="success">{t.checkout.active}</Notice>
        <LinkButton href={pages.classGroup(view.classGroupId)} variant="primary">
          {t.checkout.goToClass}
        </LinkButton>
      </div>
    );
  }
  if (view.state === "failed") {
    if (view.failure === "initialization") return <Notice tone="warning">{t.checkout.initFailed}</Notice>;
    if (view.failure === "payment_failed") return <Notice tone="warning">{t.checkout.paymentFailed}</Notice>;
    return <Notice tone="warning">{t.checkout.held}</Notice>;
  }
  return <Notice>{long ? t.checkout.pendingLong : t.checkout.pending}</Notice>;
}
