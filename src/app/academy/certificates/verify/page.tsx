import type { Metadata } from "next";
import { headers } from "next/headers";
import { publicLocale } from "@/components/academy/public-locale";
import { DomainError } from "@/lib/academy/domain/errors";
import { formatPublicDate } from "@/lib/academy/public/messages";
import { certificateService } from "@/lib/academy/server";
import { checkRateLimit, clientKey } from "@/lib/security/rate-limit";

// Public certificate verification (valid / revoked / not found). A plain GET
// form so it works without JavaScript. Rate limited per client network key
// (abuse signal only); the answer carries no account identifiers.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify a certificate | Ruh-Ul-Qudus Academy",
  description: "Check whether a Ruh-Ul-Qudus Academy certificate is valid.",
  robots: { index: false, follow: false },
};

const LIMIT = { limit: 30, windowMs: 10 * 60 * 1000 };

type Props = { searchParams: Promise<{ code?: string | string[] }> };

export default async function VerifyCertificatePage({ searchParams }: Props) {
  const { locale, t } = await publicLocale();
  const raw = (await searchParams).code;
  const code = typeof raw === "string" ? raw.slice(0, 40) : "";

  let outcome:
    | { kind: "none" }
    | { kind: "limited" }
    | { kind: "unavailable" }
    | { kind: "result"; result: Awaited<ReturnType<typeof certificateService.verify>> } = { kind: "none" };

  if (code.trim() !== "") {
    const check = checkRateLimit(`certificate-verify:${clientKey({ headers: await headers() })}`, LIMIT);
    if (!check.allowed) {
      outcome = { kind: "limited" };
    } else {
      try {
        outcome = { kind: "result", result: await certificateService.verify(code) };
      } catch (error) {
        if (!(error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE")) throw error;
        outcome = { kind: "unavailable" };
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="text-3xl font-semibold">{t.verifyTitle}</h1>
      <p className="mt-2 text-muted-foreground">{t.verifyIntro}</p>

      <form method="get" className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="code" className="block text-sm font-medium">{t.verifyLabel}</label>
          <input
            id="code"
            name="code"
            defaultValue={code}
            required
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono uppercase"
          />
        </div>
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">
          {t.verifyButton}
        </button>
      </form>

      <div aria-live="polite" className="mt-6">
        {outcome.kind === "limited" && <p role="alert" className="rounded-md border p-4">{t.verifyTooMany}</p>}
        {outcome.kind === "unavailable" && <p role="status" className="rounded-md border p-4">{t.notAvailable}</p>}
        {outcome.kind === "result" && outcome.result.status === "not_found" && <p role="status" className="rounded-md border p-4">{t.verifyNotFound}</p>}
        {outcome.kind === "result" && outcome.result.status !== "not_found" && (
          <section className="rounded-md border p-4">
            <p className="font-semibold">{outcome.result.status === "valid" ? t.verifyValid : t.verifyRevoked}</p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t.certificateLearner}</dt>
              <dd>{outcome.result.learnerName}</dd>
              <dt className="text-muted-foreground">{t.certificateCourse}</dt>
              <dd>{outcome.result.courseTitle}</dd>
              <dt className="text-muted-foreground">{t.certificateIssued}</dt>
              <dd>{formatPublicDate(outcome.result.issuedAt, locale)}</dd>
              {outcome.result.status === "revoked" && (
                <>
                  <dt className="text-muted-foreground">{t.certificateRevokedOn}</dt>
                  <dd>{formatPublicDate(outcome.result.revokedAt, locale)}</dd>
                </>
              )}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
