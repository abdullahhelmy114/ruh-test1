"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { TeacherApplicationReview, TeacherDocumentLink } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, Card, EmptyState, FailureNotice, Field, KeyValues, Notice, PageHeader, Section, TextArea } from "@/components/academy/workspace/ui";
import { teacherAccountStatusKey } from "@/lib/academy/teachers/applications";

type Command = TeacherApplicationReview["commands"][number];
const REASON_REQUIRED: readonly Command[] = ["request_changes", "reject"];

// One teacher application for review: what the applicant sent, their account
// facts, private documents (short-lived links, every opening audited), the
// history, and the decisions the application's state allows, sent with the
// revision on screen so a stale page or a concurrent decision is refused.
export default function TeacherApplicationReviewPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const text = useAdminText();
  const tt = text.teachers;
  const { t, fmt, dateTime } = useWorkspace();
  const f = t.application.fields;
  const { state, reload } = useApi<TeacherApplicationReview>(adminApi.teacherApplication(applicationId));

  return (
    <ApiView state={state} onRetry={reload}>
      {({ application, account, history, commands }) => {
        const d = application.details;
        // The server refuses a decision unless the account is a teacher at the status the application implies;
        // say so before the administrator tries. A final application has no decisions to block.
        const open = commands.length > 0;
        const missing = open && !account.exists;
        const mismatch = open && account.exists && (account.role !== "teacher" || account.status !== account.expectedStatus);
        const statusLabel = (status: string | null) => tt.accountStatus[teacherAccountStatusKey(status)];
        return (
          <>
            <PageHeader
              back={{ href: managePages.teachers, label: tt.title }}
              title={`${tt.detailTitle}: ${d.firstName} ${d.lastName}`}
              actions={<Badge tone={application.state === "approved" ? "strong" : application.state === "changes_requested" ? "warning" : "neutral"}>{tt.applicationState[application.state]}</Badge>}
            />

            <Section title={tt.account}>
              <Card className="space-y-2">
                <KeyValues
                  items={[
                    { label: tt.email, value: <span dir="ltr">{account.email ?? "—"}</span> },
                    { label: tt.emailVerified, value: account.emailVerified ? tt.emailVerified : tt.emailNotVerified },
                    { label: tt.status, value: account.exists ? statusLabel(account.status) : "—" },
                    {
                      label: tt.signIn,
                      value:
                        account.signInAccountExists === null ? tt.signInUnknown : !account.signInAccountExists ? tt.signInMissing : account.signInAccountDisabled ? tt.signInDisabled : tt.signInOk,
                    },
                    { label: text.field.version, value: fmt(tt.revision, { number: application.revision }) },
                  ]}
                />
                {missing && <Notice tone="warning">{tt.noAccount}</Notice>}
                {mismatch && <Notice tone="warning">{fmt(tt.profileMismatch, { status: account.role === "teacher" ? statusLabel(account.status) : account.role ?? "—", expected: statusLabel(account.expectedStatus) })}</Notice>}
              </Card>
            </Section>

            <Section title={tt.details}>
              <Card>
                <KeyValues
                  items={[
                    { label: f.countryOfResidence, value: d.countryOfResidence },
                    { label: f.nationality, value: d.nationality },
                    { label: f.gender, value: f.genders[d.gender] },
                    { label: f.languages, value: d.languages.map((l) => `${l.code} (${f.proficiencies[l.proficiency]})`).join(", ") },
                    { label: f.bio, value: <span className="whitespace-pre-line" dir="auto">{d.bio}</span> },
                    {
                      label: f.socialLinks,
                      value: d.socialLinks.length ? (
                        <ul className="space-y-1">
                          {d.socialLinks.map((link, index) => (
                            <li key={index}>
                              {link.platform}:{" "}
                              <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline" dir="ltr">
                                {link.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      ),
                    },
                  ]}
                />
              </Card>
            </Section>

            <Section title={tt.contact}>
              <Card>
                <KeyValues
                  items={[
                    { label: f.whatsapp, value: <span dir="ltr">{d.whatsapp}</span> },
                    { label: f.telegram, value: <span dir="ltr">{d.telegram}</span> },
                  ]}
                />
              </Card>
            </Section>

            <Section title={tt.documents}>
              <div className="flex flex-wrap gap-3">
                <DocumentOpener applicationId={application.id} kind="cv" available={application.hasCv} label={tt.openCv} />
                <DocumentOpener applicationId={application.id} kind="intro_video" available={application.hasIntroVideo} label={tt.openVideo} />
              </div>
            </Section>

            <Section title={tt.decide}>
              {open ? <Decision applicationId={application.id} revision={application.revision} commands={commands} blocked={missing || mismatch} onDecided={reload} /> : <EmptyState>{tt.final}</EmptyState>}
            </Section>

            <Section title={tt.history}>
              {history.length === 0 ? (
                <EmptyState>{tt.noHistory}</EmptyState>
              ) : (
                <ol className="space-y-2">
                  {history.map((event) => (
                    <li key={event.revision} className="rounded-md border p-3 text-sm">
                      <p className="font-medium">
                        {tt.event[event.action]} · {tt.by[event.actorRole]}
                        {event.actorName ? ` (${event.actorName})` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {dateTime(event.occurredAt)} · {fmt(tt.revision, { number: event.revision })}
                      </p>
                      {event.reason && (
                        <p className="mt-1 whitespace-pre-line" dir="auto">
                          {event.reason}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </>
        );
      }}
    </ApiView>
  );
}

function DocumentOpener({ applicationId, kind, available, label }: { readonly applicationId: string; readonly kind: "cv" | "intro_video"; readonly available: boolean; readonly label: string }) {
  const tt = useAdminText().teachers;
  const { fmt, dateTime } = useWorkspace();
  const action = useAction();
  const [link, setLink] = useState<TeacherDocumentLink | null>(null);
  if (!available) {
    return (
      <p className="text-sm text-muted-foreground">
        {label}: {tt.noDocument}
      </p>
    );
  }
  async function open() {
    const result = await action.run<TeacherDocumentLink>(adminApi.teacherApplicationDocument(applicationId, kind), "POST");
    if (result.ok) setLink(result.data);
  }
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" busy={action.busy} onClick={() => void open()}>
        {label}
      </Button>
      {link && (
        <p className="text-sm">
          {fmt(tt.linkReady, { time: dateTime(link.expiresAt) })}{" "}
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="underline">
            {tt.openLink}
          </a>
        </p>
      )}
      {action.failure && <FailureNotice failure={action.failure} />}
    </div>
  );
}

function Decision({
  applicationId,
  revision,
  commands,
  blocked,
  onDecided,
}: {
  readonly applicationId: string;
  readonly revision: number;
  readonly commands: readonly Command[];
  readonly blocked: boolean;
  readonly onDecided: () => void;
}) {
  const tt = useAdminText().teachers;
  const action = useAction();
  const [command, setCommand] = useState<Command | "">("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const needsReason = command !== "" && REASON_REQUIRED.includes(command);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!command) return;
    setDone(false);
    const result = await action.run(adminApi.teacherApplication(applicationId), "PATCH", { command, reason: reason.trim() || undefined, expectedRevision: revision });
    if (result.ok) {
      setDone(true);
      setCommand("");
      setReason("");
      onDecided();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset disabled={action.busy || blocked} className="space-y-3">
        <legend className="sr-only">{tt.decide}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tt.decide}>
          {commands.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input type="radio" name={`decision-${applicationId}`} value={c} checked={command === c} onChange={() => setCommand(c)} />
              {tt.command[c]}
            </label>
          ))}
        </div>
        {command === "approve" && <Notice tone="warning">{tt.approveNote}</Notice>}
        <Field label={tt.reason} htmlFor={`decision-reason-${applicationId}`} hint={tt.reasonHint} optional={!needsReason}>
          <TextArea id={`decision-reason-${applicationId}`} required={needsReason} maxLength={2000} rows={3} dir="auto" aria-describedby={`decision-reason-${applicationId}-hint`} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Button type="submit" busy={action.busy} disabled={!command}>
          {command ? tt.command[command] : tt.decide}
        </Button>
      </fieldset>
      {done && <Notice tone="success">{tt.decided}</Notice>}
      {action.failure && <FailureNotice failure={action.failure} onRetry={onDecided} />}
    </form>
  );
}
