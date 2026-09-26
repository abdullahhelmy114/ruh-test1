"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import { useAction, useApi } from "./api";
import { useWorkspace } from "./context";
import { Eyebrow } from "./dashboard";
import { ApiView, Button, FailureNotice, TextLink } from "./ui";

interface Referral {
  readonly code: string | null;
  readonly path: string | null;
  readonly joined: number;
  readonly rewardsOffered: boolean;
}

/**
 * The live referral program, truthfully: the API serves any signed-in
 * account, returns the caller's own code, link path and how many accounts
 * joined through it — and offers no monetary rewards, so no earnings,
 * commissions or tiers are shown.
 */
export function ReferralModule() {
  const { t, number } = useWorkspace();
  const { state, reload } = useApi<Referral>("/api/referral");
  const create = useAction();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  async function createLink() {
    const result = await create.run("/api/referral", "POST");
    if (result.ok) reload();
  }

  return (
    <section aria-label={t.teach.referralTitle} className="rounded-2xl border bg-card p-5 text-card-foreground">
      <Eyebrow>
        <Gift aria-hidden="true" className="h-3.5 w-3.5" />
        {t.teach.referralTitle}
      </Eyebrow>
      <h2 className="mt-1 font-serif text-2xl">{t.teach.referralLink}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t.teach.referralIntro} {t.teach.referralNoRewards}
      </p>
      <ApiView state={state} onRetry={reload}>
        {(referral) =>
          referral.path ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-3">
                <code dir="ltr" className="min-w-0 flex-1 truncate bg-transparent px-1 font-mono text-sm">
                  {origin}
                  {referral.path}
                </code>
                <Button type="button" variant="primary" size="sm" onClick={() => void copy(`${origin}${referral.path}`)}>
                  {copied === "done" ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                  {copied === "done" ? t.teach.copied : t.teach.copy}
                </Button>
              </div>
              <p aria-live="polite" className="mt-1.5 min-h-5 text-sm">
                {copied === "done" && <span className="text-muted-foreground">{t.teach.copied}</span>}
                {copied === "failed" && <span className="text-destructive">{t.teach.copyFailed}</span>}
              </p>
              <div className="rounded-xl bg-gold/10 p-4 text-center">
                <p className="font-serif text-3xl tabular-nums">{number(referral.joined)}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t.teach.joinedLabel}</p>
              </div>
              <p className="mt-3 text-sm">
                <TextLink href="/affiliate">{t.dashboard.openReferral}</TextLink>
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {create.failure && <FailureNotice failure={create.failure} />}
              <Button type="button" busy={create.busy} onClick={() => void createLink()}>
                {t.teach.createLink}
              </Button>
            </div>
          )
        }
      </ApiView>
    </section>
  );
}
