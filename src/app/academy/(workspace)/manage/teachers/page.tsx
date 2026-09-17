"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { TeacherAccounts, TeacherApplications } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, DataTable, FailureNotice, Field, Notice, PageHeader, ReasonField, Section, SelectInput, TextLink } from "@/components/academy/workspace/ui";
import { displayName } from "@/lib/academy/workspace/format";
import { TEACHER_APPLICATION_STATES } from "@/lib/academy/domain/states";
import { AWAITING_DECISION_FILTER, teacherAccountStatusKey } from "@/lib/academy/teachers/applications";

// Teachers: applications waiting for (or past) review, and teacher accounts with
// their status. The server decides every action; statuses are spelled out so an
// applicant is never mistaken for a teacher.
export default function TeachersPage() {
  const text = useAdminText();
  const tt = text.teachers;
  const { t, date } = useWorkspace();
  // The review queue first: submitted, in review or at interview.
  const [stateFilter, setStateFilter] = useState<string>(AWAITING_DECISION_FILTER);
  const applications = useApi<TeacherApplications>(adminApi.teacherApplications(stateFilter || undefined));
  const teachers = useApi<TeacherAccounts>(adminApi.teachers());

  return (
    <>
      <PageHeader title={tt.title} intro={tt.intro} />

      <Section title={tt.applications}>
        <div className="mb-3 max-w-sm">
          <Field label={tt.filter} htmlFor="teacher-application-state">
            <SelectInput id="teacher-application-state" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value={AWAITING_DECISION_FILTER}>{tt.awaitingDecision}</option>
              <option value="">{tt.allStates}</option>
              {TEACHER_APPLICATION_STATES.filter((s) => s !== "draft").map((state) => (
                <option key={state} value={state}>
                  {tt.applicationState[state]}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <ApiView state={applications.state} onRetry={applications.reload}>
          {(rows) => (
            <DataTable
              caption={tt.applications}
              rows={rows}
              rowKey={(row) => row.id}
              empty={tt.noApplications}
              columns={[
                { key: "name", header: tt.applicant, cell: (row) => <TextLink href={managePages.teacherApplication(row.id)}>{displayName(row.name, t.common.unnamed)}</TextLink> },
                { key: "email", header: tt.email, cell: (row) => <span dir="ltr">{row.email ?? "—"}</span> },
                { key: "verified", header: tt.emailVerified, cell: (row) => <Badge tone={row.emailVerified ? "neutral" : "warning"}>{row.emailVerified ? tt.emailVerified : tt.emailNotVerified}</Badge> },
                { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "approved" ? "strong" : row.state === "changes_requested" ? "warning" : "neutral"}>{tt.applicationState[row.state]}</Badge> },
                { key: "submitted", header: tt.submitted, cell: (row) => date(row.submittedAt) || "—" },
              ]}
            />
          )}
        </ApiView>
      </Section>

      <Section title={tt.directory}>
        <Notice>{tt.deactivateWarning}</Notice>
        <div className="mt-3">
          <ApiView state={teachers.state} onRetry={teachers.reload}>
            {(rows) => (
              <DataTable
                caption={tt.directory}
                rows={rows}
                rowKey={(row) => row.uid}
                empty={tt.noTeachers}
                columns={[
                  { key: "name", header: text.field.name, cell: (row) => displayName(row.name, t.common.unnamed) },
                  { key: "email", header: tt.email, cell: (row) => <span dir="ltr">{row.email ?? "—"}</span> },
                  { key: "status", header: tt.status, cell: (row) => <Badge tone={row.status === "active" ? "strong" : row.status === "inactive" ? "warning" : "neutral"}>{tt.accountStatus[teacherAccountStatusKey(row.status)]}</Badge> },
                  { key: "assignments", header: tt.openAssignments, cell: (row) => String(row.openAssignments) },
                  {
                    key: "application",
                    header: tt.application,
                    cell: (row) => (row.application ? <TextLink href={managePages.teacherApplication(row.application.id)}>{tt.applicationState[row.application.state]}</TextLink> : tt.noApplication),
                  },
                  { key: "actions", header: tt.actions, cell: (row) => <AccountCommand uid={row.uid} status={row.status} onChanged={teachers.reload} /> },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>
    </>
  );
}

/** Deactivate (with a reason) an active teacher, or reactivate a deactivated one, on the status shown. */
function AccountCommand({ uid, status, onChanged }: { readonly uid: string; readonly status: string | null; readonly onChanged: () => void }) {
  const tt = useAdminText().teachers;
  const { t } = useWorkspace();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (status !== "active" && status !== "inactive") return null;
  const command = status === "active" ? "deactivate" : "reactivate";

  async function run() {
    const result = await action.run(adminApi.teacher(uid), "PATCH", { command, reason: reason || undefined, expectedStatus: status });
    if (result.ok) {
      setOpen(false);
      setReason("");
      onChanged();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run();
  }

  if (command === "reactivate") {
    return (
      <div className="space-y-2">
        <Button type="button" size="sm" variant="outline" busy={action.busy} onClick={() => void run()}>
          {tt.reactivate}
        </Button>
        {action.failure && <FailureNotice failure={action.failure} />}
      </div>
    );
  }
  return open ? (
    <form onSubmit={submit} className="space-y-2">
      <ReasonField id={`deactivate-${uid}`} value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="danger" busy={action.busy}>
          {tt.deactivate}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
      {action.failure && <FailureNotice failure={action.failure} />}
    </form>
  ) : (
    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
      {tt.deactivate}
    </Button>
  );
}
