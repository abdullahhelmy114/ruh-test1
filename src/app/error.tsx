"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { resolveLocale } from "@/i18n/config";
import { PUBLIC_MESSAGES } from "@/lib/academy/public/messages";

// The document's language does not change while this page is shown.
const noSubscription = () => () => {};
const documentLang = () => document.documentElement.lang;
const noServerLang = () => "";

/**
 * The fallback for an unexpected error in any page below the root layout.
 *
 * Without it a failing page showed Next's bare "Application error" screen in
 * English with no way back. It renders inside the root layout, so the header,
 * lang and dir stay; the reader's language is read from the document the
 * layout already labelled. Nothing about the error is shown: server errors
 * arrive without their message in production and only the digest links the
 * page to the server log.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = PUBLIC_MESSAGES[resolveLocale(useSyncExternalStore(noSubscription, documentLang, noServerLang))];

  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-serif text-2xl text-foreground">{t.errorTitle}</h1>
      <p className="mt-3 text-muted-foreground">{t.errorBody}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.tryAgain}
        </button>
        <Link href="/" className="text-sm underline underline-offset-4 hover:no-underline focus-visible:no-underline">
          {t.backToHome}
        </Link>
      </div>
      {error.digest && <p className="mt-8 font-mono text-xs text-muted-foreground" dir="ltr">{error.digest}</p>}
    </div>
  );
}
