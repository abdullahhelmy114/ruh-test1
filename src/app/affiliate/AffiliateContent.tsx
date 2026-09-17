"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Copy, Share2, UserPlus, Users } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/lib/firebase/AuthProvider";

interface OwnReferral {
  readonly code: string | null;
  readonly path: string | null;
  readonly joined: number;
}

type LoadState = { readonly status: "loading" } | { readonly status: "failed" } | { readonly status: "ready"; readonly referral: OwnReferral };

// Invitations. A signed-in account sees its own link (from /api/referral, keyed
// by its session) and how many accounts were created with it. No reward,
// commission or payout is offered, and the page says so; see lib/referral.ts.
export function AffiliateContent() {
  const { user, isLoading } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const call = useCallback(async (method: "GET" | "POST") => {
    try {
      const res = await authFetch("/api/referral", { method });
      const body = await res.json().catch(() => null);
      setState(res.ok && body?.data ? { status: "ready", referral: body.data as OwnReferral } : { status: "failed" });
    } catch {
      setState({ status: "failed" });
    }
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;
    void call("GET");
  }, [user, isLoading, call]);

  const link = state.status === "ready" && state.referral.path ? `${window.location.origin}${state.referral.path}` : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const createLink = async () => {
    setCreating(true);
    await call("POST");
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <T>Invite friends</T>
          </div>
          <h1 className="mt-6 font-serif text-4xl font-bold text-foreground md:text-5xl">
            <T>Invite a friend to the academy</T>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            <T>Share your personal link. When a friend creates a student account with it, the invitation is recorded on your account.</T>
          </p>
          <p className="mx-auto mt-4 max-w-2xl rounded-2xl border bg-card px-4 py-3 text-sm text-foreground" role="note">
            <T>Referral rewards are not offered at this time.</T>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12 md:px-8">
        <ol className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Share2, title: "Copy your link", text: "Send your personal link to a friend." },
            { icon: UserPlus, title: "Your friend signs up", text: "They create a student account from your link." },
            { icon: Users, title: "Follow your invitations", text: "See how many friends joined, here and on your dashboard." },
          ].map((step) => (
            <li key={step.title} className="rounded-3xl border bg-card p-6 text-center">
              <step.icon className="mx-auto h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-serif text-lg font-semibold text-foreground">
                <T>{step.title}</T>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                <T>{step.text}</T>
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 md:px-8">
        <div className="rounded-3xl border bg-card p-6 text-center md:p-8">
          {isLoading ? null : !user ? (
            <>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                <T>Sign in to get your invitation link</T>
              </h2>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login" className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
                  <T>Sign in</T>
                </Link>
                <Link href="/signup/student" className="rounded-full border px-6 py-2.5 text-sm font-semibold">
                  <T>Create a student account</T>
                </Link>
              </div>
            </>
          ) : state.status === "loading" ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <T>Loading</T>
            </p>
          ) : state.status === "failed" ? (
            <div aria-live="polite">
              <p className="text-sm text-muted-foreground">
                <T>Your invitation link could not be loaded.</T>
              </p>
              <button type="button" onClick={() => void call("GET")} className="mt-3 rounded-full border px-5 py-2 text-sm">
                <T>Try again</T>
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-2xl font-semibold text-foreground">
                <T>Your invitation link</T>
              </h2>
              {link ? (
                <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
                  <code className="min-w-0 break-all rounded-2xl border bg-background px-4 py-2.5 text-sm" dir="ltr">
                    {link}
                  </code>
                  <button type="button" onClick={() => void copyLink()} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
                    {copied ? <CheckCircle size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    <T>{copied ? "Link Copied!" : "Copy your link"}</T>
                  </button>
                </div>
              ) : (
                <button type="button" disabled={creating} onClick={() => void createLink()} className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  <T>Create my invitation link</T>
                </button>
              )}
              <p className="mt-6 text-sm text-muted-foreground">
                <T>Friends who joined</T>: <span className="font-semibold text-foreground">{state.referral.joined}</span>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
