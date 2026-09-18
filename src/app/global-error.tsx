"use client";

import { useSyncExternalStore } from "react";
import { LOCALE_COOKIE, localeDirection, resolveLocale } from "@/i18n/config";
import { PUBLIC_MESSAGES } from "@/lib/academy/public/messages";

// This document replaces the root layout, so the reader's language comes
// from the same preference cookie the layout reads.
const noSubscription = () => () => {};
const cookieLocale = () =>
  document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1) ?? "";
const noServerLocale = () => "";

const STYLE = `
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; background: #ffffff; color: #111827; }
  main { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0; }
  p { margin: 12px 0 0; color: #4b5563; max-width: 36rem; }
  .actions { margin-top: 24px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; justify-content: center; }
  button { border: 0; border-radius: 9999px; padding: 10px 24px; font: inherit; font-weight: 600; background: #1e3a8a; color: #ffffff; cursor: pointer; }
  a { color: inherit; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b1120; color: #f3f4f6; }
    p { color: #9ca3af; }
    button { background: #e5e7eb; color: #0b1120; }
  }
`;

/**
 * The last-resort fallback when the root layout itself fails. Without it the
 * visitor got Next's unstyled default. It must render its own document.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = resolveLocale(useSyncExternalStore(noSubscription, cookieLocale, noServerLocale));
  const t = PUBLIC_MESSAGES[locale];

  return (
    <html lang={locale} dir={localeDirection(locale)}>
      <head>
        <title>{t.errorTitle}</title>
        <meta name="robots" content="noindex" />
        <style>{STYLE}</style>
      </head>
      <body>
        <main role="alert">
          <h1>{t.errorTitle}</h1>
          <p>{t.errorBody}</p>
          <div className="actions">
            <button type="button" onClick={() => retry()}>
              {t.tryAgain}
            </button>
            {/* A full navigation: the root layout is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">{t.backToHome}</a>
          </div>
          {error.digest && (
            <p dir="ltr" style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
              {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
