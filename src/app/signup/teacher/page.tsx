"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApplicationForm, type ApplicationSubmission } from "@/components/academy/workspace/teacher/application-form";
import { Field, PageHeader, TextInput } from "@/components/academy/workspace/ui";

// Apply to teach: the account (email, password) and the teacher application in
// one form. The server creates an account whose application is under review;
// nothing here grants teaching access. After the email address is verified the
// applicant signs in and follows the review on their application page.
export default function TeacherSignupPage() {
  const { t } = useWorkspace();
  const s = t.signup;
  const router = useRouter();
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(submission: ApplicationSubmission) {
    setProblem(null);
    if (password !== confirm) {
      setProblem(s.passwordMismatch);
      return;
    }
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/signup/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: { email, password }, details: submission.details, cv: submission.cv, introVideo: submission.introVideo }),
      });
    } catch {
      setBusy(false);
      setProblem(t.states.network);
      return;
    }
    const body = (await response.json().catch(() => null)) as { message?: unknown; code?: unknown } | null;
    if (response.ok) {
      router.push(`/verify-teacher?email=${encodeURIComponent(email.trim())}`);
      return;
    }
    setBusy(false);
    if (response.status === 409) setProblem(s.emailInUse);
    else if (response.status === 503 && body?.code === "not_open") setProblem(s.notOpen);
    else if (response.status === 429) setProblem(t.states.rateLimited);
    else if (response.status === 400 && typeof body?.message === "string") setProblem(body.message);
    else setProblem(t.states.server);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <PageHeader title={s.title} intro={s.intro} />
      <ApplicationForm
        cvRequired
        submitLabel={busy ? s.creating : s.create}
        busy={busy}
        onSubmit={submit}
        before={
          <section aria-labelledby={`${id}-account`} className="space-y-4">
            <h2 id={`${id}-account`} className="text-lg font-semibold">
              {s.stepAccount}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={s.email} htmlFor={`${id}-email`}>
                <TextInput id={`${id}-email`} type="email" required dir="ltr" autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <div className="hidden sm:block" aria-hidden="true" />
              <Field label={s.password} htmlFor={`${id}-password`} hint={s.passwordHint}>
                <TextInput id={`${id}-password`} type="password" required dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby={`${id}-password-hint`} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label={s.confirmPassword} htmlFor={`${id}-confirm`}>
                <TextInput id={`${id}-confirm`} type="password" required dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            </div>
            <h2 className="pt-2 text-lg font-semibold">{s.stepApplication}</h2>
          </section>
        }
        after={
          problem && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              {problem}
            </p>
          )
        }
      />
      <div className="mt-8 space-y-2 text-sm">
        <p>
          {s.haveAccount}{" "}
          <Link href="/login" className="font-medium underline underline-offset-4">
            {s.signIn}
          </Link>
        </p>
        <p>
          <Link href="/signup/student" className="underline underline-offset-4">
            {s.student}
          </Link>
        </p>
      </div>
    </main>
  );
}
