/**
 * Runtime fixes: server-resolved <html lang dir> (no beforeInteractive script)
 * and an early, value-free Firebase web-config guard.
 * Behavioural: locale helpers. Static: layout, switcher and client wiring
 * (comments stripped before assertions).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALE_COOKIE,
  defaultLocale,
  isLocale,
  localeDirection,
  locales,
  resolveLocale,
} from "../../src/i18n/config.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const code = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

describe("locale helpers", () => {
  test("cookie key matches the existing localStorage key; list unchanged", () => {
    assert.equal(LOCALE_COOKIE, "preferred-locale");
    assert.deepEqual([...locales], ["en", "ar", "tr"]);
    assert.equal(defaultLocale, "en");
  });

  test("only allowlisted locales resolve; anything else falls back to the default", () => {
    for (const l of ["en", "ar", "tr"]) assert.equal(resolveLocale(l), l);
    for (const bad of [undefined, null, "", "AR", "fr", "ar ", "ar;x", "<script>", 1, {}, ["ar"]]) {
      assert.equal(resolveLocale(bad), "en", `should fall back for ${JSON.stringify(bad)}`);
      assert.equal(isLocale(bad), false);
    }
  });

  test("Arabic is RTL; English and Turkish are LTR", () => {
    assert.equal(localeDirection("ar"), "rtl");
    assert.equal(localeDirection("en"), "ltr");
    assert.equal(localeDirection("tr"), "ltr");
  });
});

describe("root layout", () => {
  const src = code("app/layout.tsx");
  test("no direction bootstrap script of any kind", () => {
    for (const needle of ["next/script", "beforeInteractive", "set-direction", "<Script", "<script", "dangerouslySetInnerHTML", "localStorage"]) {
      assert.equal(src.includes(needle), false, `layout must not contain ${needle}`);
    }
  });

  test("lang and dir resolved on the server from the validated cookie", () => {
    assert.ok(src.includes('import { cookies } from "next/headers"'));
    assert.ok(src.includes("export default async function RootLayout("));
    assert.ok(src.includes("resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value)"));
    assert.ok(src.includes("lang={locale}") && src.includes("dir={localeDirection(locale)}"));
    assert.equal(src.includes('lang="en"'), false, "no hard-coded language");
  });
});

describe("language switcher", () => {
  const src = code("components/LanguageSwitcher.tsx");
  test("keeps existing behaviour and mirrors the choice into the cookie", () => {
    assert.ok(src.includes('localStorage.setItem("preferred-locale", newLocale)'), "localStorage preference kept");
    assert.ok(src.includes("writeLocaleCookie(newLocale)"), "cookie written on change");
    assert.ok(src.includes("document.documentElement.dir = newLocale"), "immediate direction update kept");
    assert.ok(src.includes('new CustomEvent("locale-change"'), "locale-change event kept");
    assert.ok(src.includes("`${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax${secure}`"));
    assert.ok(src.includes("if (!isLocale(locale)) return;"), "only allowlisted values are written");
  });

  test("syncs a pre-existing localStorage preference into the cookie once", () => {
    assert.ok(src.includes("if (isLocale(stored))") && src.includes("writeLocaleCookie(stored)"));
  });
});

describe("auth provider wrapper", () => {
  const raw = readFileSync(join(SRC, "lib/firebase/AuthProviderLazy.tsx"), "utf8");
  const src = code("lib/firebase/AuthProviderLazy.tsx");

  test("renders AuthProvider directly with no post-mount wrapper swap", () => {
    for (const needle of ["dynamic(", "next/dynamic", "useState", "useEffect", "isClient", "setIsClient", "ssr:", "loading:"]) {
      assert.equal(src.includes(needle), false, `AuthProviderLazy must not contain ${needle}`);
    }
    assert.equal(/return\s*<>\s*\{children\}\s*<\/>/.test(src), false, "no children-only first render");
  });

  test("imports AuthProvider and keeps children inside it", () => {
    assert.ok(raw.startsWith('"use client";'), "stays a client component");
    assert.ok(src.includes('import { AuthProvider } from "./AuthProvider"'));
    assert.ok(src.includes("export default function AuthProviderLazy("), "public component name unchanged");
    assert.ok(/return\s*<AuthProvider>\{children\}<\/AuthProvider>/.test(src), "children rendered inside the provider");
    assert.equal((src.match(/\breturn\b/g) ?? []).length, 1, "a single, unconditional render path");
  });
});

describe("firebase web client", () => {
  const src = code("lib/firebase/client.ts");
  const NAMES = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];

  test("reads the exact public names with literal access (inlinable)", () => {
    for (const n of NAMES) assert.ok(src.includes(`process.env.${n}`), `${n} read literally`);
    assert.equal(/process\.env\[/.test(src), false, "no dynamic env access (would not be inlined)");
  });

  test("guard throws a value-free error before initializeApp/getAuth", () => {
    const guard = src.indexOf("if (invalidWebConfig.length > 0)");
    assert.ok(guard > 0);
    assert.ok(guard < src.indexOf("initializeApp(firebaseConfig)"), "guard precedes initializeApp");
    assert.ok(guard < src.indexOf("getAuth(app)"), "guard precedes getAuth");
    assert.ok(src.includes('field === "apiKey" && value.includes(":")'), "mirrors the SDK's malformed-key condition");
    assert.ok(src.includes('invalidWebConfig.join(", ")'), "reports variable names only");
    assert.equal(/firebaseConfig\.(apiKey|appId|authDomain|projectId)\s*[,)}]|\$\{\s*(firebaseConfig|value)/.test(src), false, "no config value interpolated into the message");
    assert.equal(/console\.(log|error|warn)/.test(src), false, "nothing logged");
  });

  test("no server-only Firebase Admin credential is referenced", () => {
    for (const secret of ["FIREBASE_ADMIN_KEY", "FIREBASE_PRIVATE_KEY", "FIREBASE_CLIENT_EMAIL", "firebase-admin"]) {
      assert.equal(src.includes(secret), false, `${secret} must not appear in the web client`);
    }
  });
});
