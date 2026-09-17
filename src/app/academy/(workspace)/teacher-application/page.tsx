"use client";

import { useState } from "react";
import type { TeacherApplicationView } from "@/components/academy/workspace/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import { ApplicationForm, type ApplicationSubmission } from "@/components/academy/workspace/teacher/application-form";
import { ApiView, Badge, Card, FailureNotice, LinkButton, Notice, PageHeader, Section } from "@/components/academy/workspace/ui";

// A teacher account's own application: where it stands, the academy's note when
// changes were requested or it was not approved, and the form to send it (an
// account created before applications were recorded) or to revise it. The
// server decides everything shown here; nothing grants teaching access.
export default function TeacherApplicationPage() {
  const { t, fmt, date } = useWorkspace();
  const a = t.application;
  const { state, reload } = useApi<TeacherApplicationView>(api.teacherApplication);
  const action = useAction();
  const [sent, setSent] = useState(false);

  async function send(submission: ApplicationSubmission, revision: number | null) {
    setSent(false);
    const body = { details: submission.details, cv: submission.cv, introVideo: submission.introVideo, ...(revision === null ? {} : { expectedRevision: revision }) };
    const result = await action.run(api.teacherApplication, revision === null ? "POST" : "PATCH", body);
    if (result.ok) {
      setSent(true);
      reload();
    }
  }

  return (
    <>
      <PageHeader title={a.title} intro={a.intro} />
      <ApiView state={state} onRetry={reload}>
        {(view) => {
          const application = view.application;
          return (
            <div className="space-y-6">
              {sent && <Notice tone="success">{a.sent}</Notice>}
              {view.accountStatus === "inactive" && <Notice tone="warning">{a.inactive}</Notice>}

              {application ? (
                <Section title={a.yourApplication} actions={<Badge tone={application.state === "approved" ? "strong" : application.state === "changes_requested" ? "warning" : "neutral"}>{a.state[application.state]}</Badge>}>
                  <Card className="space-y-3">
                    <p>{a.explain[application.state]}</p>
                    {application.note && (
                      <div className="rounded-md border border-primary/30 bg-muted/40 p-3">
                        <p className="text-sm font-medium">{a.note}</p>
                        <p className="mt-1 whitespace-pre-line text-sm" dir="auto">
                          {application.note}
                        </p>
                      </div>
                    )}
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {application.submittedAt && <li>{fmt(a.sentOn, { date: date(application.submittedAt) })}</li>}
                      {application.decidedAt && <li>{fmt(a.decidedOn, { date: date(application.decidedAt) })}</li>}
                      {application.hasCv && <li>{a.cvSent}</li>}
                      {application.hasIntroVideo && <li>{a.videoSent}</li>}
                    </ul>
                    {application.state === "approved" && view.active && <LinkButton href={pages.teach} variant="primary">{a.openWorkspace}</LinkButton>}
                  </Card>
                </Section>
              ) : (
                view.canSubmit && <Notice>{a.none}</Notice>
              )}

              {action.failure && <FailureNotice failure={action.failure} />}

              {view.canRevise && application && (
                <Section title={a.resubmit}>
                  <ApplicationForm
                    key={application.revision}
                    initial={{ ...application.details, languages: application.details.languages.map((l) => ({ ...l })), socialLinks: application.details.socialLinks.map((l) => ({ ...l })) }}
                    cvRequired={false}
                    submitLabel={a.resubmit}
                    busy={action.busy}
                    onSubmit={(submission) => send(submission, application.revision)}
                  />
                </Section>
              )}

              {view.canSubmit && (
                <Section title={a.submit}>
                  <ApplicationForm cvRequired submitLabel={a.submit} busy={action.busy} onSubmit={(submission) => send(submission, null)} />
                </Section>
              )}
            </div>
          );
        }}
      </ApiView>
    </>
  );
}
