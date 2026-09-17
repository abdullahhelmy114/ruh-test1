"use client";

import { useState, type FormEvent } from "react";
import { displayName } from "@/lib/academy/workspace/format";
import { useAction, useApi } from "../api";
import { useWorkspace } from "../context";
import { api as participantApi, pages } from "../paths";
import type { AssignmentList } from "../types";
import { ApiView, Badge, Button, Card, DataTable, EmptyState, FailureNotice, Field, KeyValues, LinkButton, Notice, Section, SelectInput, TextInput, TextLink } from "../ui";
import { adminApi } from "./api-paths";
import { isoToLocal, localToIso, managePages, PersonSelect, ReasonCommand, StateChange, usePeopleNames, useAdminText } from "./kit";
import type { AdminClassGroup, Assessments, Curriculum, CurriculumVersionDetail, Eligibility, Enrollments, PreparationStatuses, Sessions, StaffRecordings } from "./types";

const CLASS_GROUP_NEXT: Readonly<Record<string, readonly string[]>> = { planned: ["active", "cancelled"], active: ["completed", "cancelled"], completed: [], cancelled: [] };
const SESSION_NEXT: Readonly<Record<string, readonly string[]>> = { scheduled: ["live", "cancelled"], live: ["completed"], completed: [], cancelled: [] };
const ENROLLMENT_NEXT: Readonly<Record<string, readonly string[]>> = { pending: ["active", "cancelled"], active: ["suspended", "withdrawn"], suspended: ["active", "withdrawn"], completed: [], withdrawn: [], cancelled: [] };
const RECORDING_NEXT: Readonly<Record<string, readonly string[]>> = { processing: ["in_review", "failed"], failed: ["processing"], in_review: ["published", "archived"], published: ["restricted", "archived"], restricted: ["published", "archived"], archived: [] };

/** Lesson titles of a curriculum version, by lesson id. */
function useLessonTitles(versionId: string) {
  const { state } = useApi<CurriculumVersionDetail>(adminApi.curriculumVersion(versionId));
  const lessons = state.status === "ready" ? state.data.outline.units.flatMap((unit) => unit.lessons) : [];
  return { lessons, titles: new Map(lessons.map((lesson) => [lesson.lessonId, lesson.title])) };
}

export function ClassGroupDetails({ data, onChanged }: { readonly data: AdminClassGroup; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { t, fmt, date } = useWorkspace();
  const group = data.classGroup;
  const [name, setName] = useState(group.name);
  const [capacity, setCapacity] = useState(group.capacity === null ? "" : String(group.capacity));
  const [startsOn, setStartsOn] = useState(group.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(group.endsOn ?? "");
  const action = useAction();

  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.classGroup(group.id), "PATCH", {
      action: "update",
      name,
      capacity: capacity === "" ? null : Number(capacity),
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      expectedRevision: group.revision,
    });
    if (result.ok) onChanged();
  }

  return (
    <>
      <Card className="mb-6">
        <KeyValues
          items={[
            { label: text.field.state, value: <Badge>{t.classGroup.status[group.status]}</Badge> },
            { label: text.field.startsOn, value: date(group.startsOn) || "—" },
            { label: text.field.endsOn, value: date(group.endsOn) || "—" },
            { label: text.field.capacity, value: group.capacity ?? "—" },
            { label: text.classGroup.tabs.enrollments, value: fmt(text.classGroup.openEnrollments, { count: data.openEnrollmentCount }) },
            ...(group.deletedAt ? [{ label: text.action.deleted, value: group.deletionReason ?? "" }] : []),
          ]}
        />
        <p className="mt-3 flex flex-wrap gap-2">
          <LinkButton href={pages.classGroup(group.id)}>{text.action.viewWorkspace}</LinkButton>
          <LinkButton href={managePages.course(group.courseId)}>{text.field.course}</LinkButton>
        </p>
      </Card>
      <Section title={text.action.save}>
        <form onSubmit={save} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
          <Field label={text.field.name} htmlFor="group-name">
            <TextInput id="group-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={text.field.capacity} htmlFor="group-capacity" optional>
            <TextInput id="group-capacity" type="number" min={1} max={10000} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </Field>
          <Field label={text.field.startsOn} htmlFor="group-starts" optional>
            <TextInput id="group-starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
          </Field>
          <Field label={text.field.endsOn} htmlFor="group-ends" optional>
            <TextInput id="group-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
          {action.failure && (
            <div className="md:col-span-2">
              <FailureNotice failure={action.failure} onRetry={onChanged} />
            </div>
          )}
          <div>
            <Button type="submit" busy={action.busy}>
              {text.action.save}
            </Button>
          </div>
        </form>
      </Section>
      <Section title={text.action.changeStatus}>
        <StateChange url={adminApi.classGroup(group.id)} states={CLASS_GROUP_NEXT[group.status] ?? []} labels={t.classGroup.status} revision={group.revision} onChanged={onChanged} reasonOptional={["active", "completed"]} />
      </Section>
      <Section title={text.action.repin}>
        <Repin classGroupId={group.id} courseId={group.courseId} current={group.curriculumVersionId} revision={group.revision} onChanged={onChanged} />
      </Section>
      <Section title={group.deletedAt ? text.action.restore : text.action.delete}>
        {group.deletedAt ? (
          <ReasonCommand label={text.action.restore} url={adminApi.classGroup(group.id)} body={{ action: "restore", expectedRevision: group.revision }} onDone={onChanged} variant="primary" />
        ) : (
          <ReasonCommand label={text.action.delete} url={adminApi.classGroup(group.id)} body={{ action: "delete", expectedRevision: group.revision }} onDone={onChanged} />
        )}
      </Section>
    </>
  );
}

function Repin({ classGroupId, courseId, current, revision, onChanged }: { readonly classGroupId: string; readonly courseId: string; readonly current: string; readonly revision: number; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const { state } = useApi<Curriculum>(adminApi.curriculum(courseId));
  const published = state.status === "ready" ? state.data.versions.filter((v) => v.state === "published" && v.id !== current) : [];
  const [versionId, setVersionId] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  if (published.length === 0) return <EmptyState>{text.course.noPublished}</EmptyState>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.classGroup(classGroupId), "PATCH", { action: "repin_curriculum", curriculumVersionId: versionId, reason, expectedRevision: revision });
    if (result.ok) onChanged();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
      <Field label={text.field.curriculumVersion} htmlFor="repin-version">
        <SelectInput id="repin-version" required value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          <option value="">{t.common.choose}</option>
          {published.map((v) => (
            <option key={v.id} value={v.id}>{`v${v.versionNumber}`}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t.common.reason} htmlFor="repin-reason">
        <TextInput id="repin-reason" required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {action.failure && (
        <div className="md:col-span-2">
          <FailureNotice failure={action.failure} onRetry={onChanged} />
        </div>
      )}
      <div>
        <Button type="submit" size="sm" busy={action.busy}>
          {text.action.repin}
        </Button>
      </div>
    </form>
  );
}

export function ClassGroupTeachers({ data, onChanged }: { readonly data: AdminClassGroup; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { t, date } = useWorkspace();
  const names = usePeopleNames();
  const [teacherUid, setTeacherUid] = useState("");
  const action = useAction();

  async function assign(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.classGroup(data.classGroup.id), "PATCH", { action: "assign_teacher", teacherUid });
    if (result.ok) {
      setTeacherUid("");
      onChanged();
    }
  }

  return (
    <>
      <Section title={text.action.assign}>
        <form onSubmit={assign} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <Field label={text.field.teacher} htmlFor="assign-teacher">
            <PersonSelect id="assign-teacher" role="teacher" value={teacherUid} onChange={setTeacherUid} />
          </Field>
          <Button type="submit" busy={action.busy}>
            {text.action.assign}
          </Button>
          {action.failure && <FailureNotice failure={action.failure} onRetry={onChanged} />}
        </form>
      </Section>
      <DataTable
        caption={text.classGroup.tabs.teachers}
        rows={data.teachers}
        rowKey={(row) => row.id}
        empty={text.classGroup.noTeachers}
        columns={[
          { key: "name", header: text.field.teacher, cell: (row) => displayName(names.get(row.teacherUid), t.common.unnamed) },
          { key: "since", header: text.field.startsOn, cell: (row) => date(row.assignedAt) },
          { key: "unassign", header: <span className="sr-only">{text.action.unassign}</span>, cell: (row) => <ReasonCommand label={text.action.unassign} url={adminApi.classGroup(data.classGroup.id)} body={{ action: "unassign_teacher", assignmentId: row.id }} onDone={onChanged} /> },
        ]}
      />
    </>
  );
}

export function ClassGroupSessions({ data }: { readonly data: AdminClassGroup }) {
  const text = useAdminText();
  const { t, sessionTime } = useWorkspace();
  const group = data.classGroup;
  const { state, reload } = useApi<Sessions>(adminApi.sessions(group.id));
  const { lessons, titles } = useLessonTitles(group.curriculumVersionId);
  const [lessonId, setLessonId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const action = useAction();

  async function schedule(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.sessions(group.id), "POST", { lessonId, startsAt: localToIso(startsAt), endsAt: localToIso(endsAt), meetingUrl: meetingUrl || undefined });
    if (result.ok) {
      setStartsAt("");
      setEndsAt("");
      reload();
    }
  }

  return (
    <>
      <Section title={text.action.schedule}>
        <form onSubmit={schedule} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
          <Field label={text.field.lesson} htmlFor="schedule-lesson">
            <SelectInput id="schedule-lesson" required value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">{t.common.choose}</option>
              {lessons.map((lesson) => (
                <option key={lesson.lessonId} value={lesson.lessonId}>
                  {lesson.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.meetingUrl} htmlFor="schedule-meeting" optional>
            <TextInput id="schedule-meeting" type="url" dir="ltr" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
          </Field>
          <Field label={text.field.startsAt} htmlFor="schedule-starts">
            <TextInput id="schedule-starts" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </Field>
          <Field label={text.field.endsAt} htmlFor="schedule-ends">
            <TextInput id="schedule-ends" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </Field>
          {action.failure && (
            <div className="md:col-span-2">
              <FailureNotice failure={action.failure} onRetry={reload} />
            </div>
          )}
          <div>
            <Button type="submit" busy={action.busy}>
              {text.action.schedule}
            </Button>
          </div>
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(sessions) =>
          sessions.length === 0 ? (
            <EmptyState>{text.classGroup.noSessions}</EmptyState>
          ) : (
            <ul className="space-y-3">
              {sessions.map((session) => (
                <li key={session.id} className="space-y-2 rounded-md border p-3">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="block text-sm text-muted-foreground">{sessionTime(session.startsAt)}</span>
                      <TextLink href={pages.session(session.id)}>{titles.get(session.lessonId) ?? text.field.lesson}</TextLink>
                    </span>
                    <Badge tone={session.state === "live" ? "strong" : "neutral"}>{t.classGroup.sessionState[session.state]}</Badge>
                  </p>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{text.action.reschedule}</summary>
                    <Reschedule session={session} onDone={reload} />
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{text.action.changeStatus}</summary>
                    <div className="mt-2">
                      <StateChange url={adminApi.session(session.id)} states={SESSION_NEXT[session.state] ?? []} labels={t.classGroup.sessionState} revision={session.revision} onChanged={reload} reasonOptional={["live", "completed"]} />
                    </div>
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{text.action.preparations}</summary>
                    <Preparations sessionId={session.id} />
                  </details>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{text.action.addRecording}</summary>
                    <AddRecording sessionId={session.id} />
                  </details>
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>
    </>
  );
}

function Reschedule({ session, onDone }: { readonly session: Sessions[number]; readonly onDone: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [startsAt, setStartsAt] = useState(isoToLocal(session.startsAt));
  const [endsAt, setEndsAt] = useState(isoToLocal(session.endsAt));
  const [meetingUrl, setMeetingUrl] = useState(session.meetingUrl ?? "");
  const [reason, setReason] = useState("");
  const action = useAction();
  const id = `reschedule-${session.id}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.session(session.id), "PATCH", {
      action: "reschedule",
      startsAt: localToIso(startsAt),
      endsAt: localToIso(endsAt),
      meetingUrl: meetingUrl || null,
      reason,
      expectedRevision: session.revision,
    });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-3 md:grid-cols-2">
      <Field label={text.field.startsAt} htmlFor={`${id}-starts`}>
        <TextInput id={`${id}-starts`} type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
      </Field>
      <Field label={text.field.endsAt} htmlFor={`${id}-ends`}>
        <TextInput id={`${id}-ends`} type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </Field>
      <Field label={text.field.meetingUrl} htmlFor={`${id}-meeting`} optional>
        <TextInput id={`${id}-meeting`} type="url" dir="ltr" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} />
      </Field>
      <Field label={t.common.reason} htmlFor={`${id}-reason`}>
        <TextInput id={`${id}-reason`} required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {action.failure && (
        <div className="md:col-span-2">
          <FailureNotice failure={action.failure} onRetry={onDone} />
        </div>
      )}
      <div>
        <Button type="submit" size="sm" busy={action.busy}>
          {text.action.reschedule}
        </Button>
      </div>
    </form>
  );
}

function Preparations({ sessionId }: { readonly sessionId: string }) {
  const { t, dateTime } = useWorkspace();
  const names = usePeopleNames();
  const { state, reload } = useApi<PreparationStatuses>(adminApi.preparations(sessionId));
  return (
    <div className="mt-2">
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={t.session.preparation}
            rows={rows}
            rowKey={(row) => row.teacherUid}
            empty={t.classGroup.noTeachers}
            columns={[
              { key: "teacher", header: t.common.teacher, cell: (row) => displayName(names.get(row.teacherUid), t.common.unnamed) },
              { key: "status", header: t.common.status, cell: (row) => <Badge tone={row.status === "ready" ? "strong" : "warning"}>{t.session.prepStatus[row.status]}</Badge> },
              { key: "updated", header: t.common.details, cell: (row) => (row.updatedAt ? dateTime(row.updatedAt) : "—") },
            ]}
          />
        )}
      </ApiView>
    </div>
  );
}

function AddRecording({ sessionId }: { readonly sessionId: string }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [title, setTitle] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [done, setDone] = useState(false);
  const action = useAction();
  const id = `recording-${sessionId}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setDone(false);
    const result = await action.run(adminApi.sessionRecordings(sessionId), "POST", { title, mediaUrl, durationSeconds: duration ? Number(duration) : undefined });
    if (result.ok) {
      setTitle("");
      setMediaUrl("");
      setDuration("");
      setDone(true);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-3 md:grid-cols-3">
      <Field label={text.field.title} htmlFor={`${id}-title`}>
        <TextInput id={`${id}-title`} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={text.field.mediaUrl} htmlFor={`${id}-url`}>
        <TextInput id={`${id}-url`} required type="url" dir="ltr" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
      </Field>
      <Field label={text.field.durationSeconds} htmlFor={`${id}-duration`} optional>
        <TextInput id={`${id}-duration`} type="number" min={1} max={86400} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </Field>
      {action.failure && (
        <div className="md:col-span-3">
          <FailureNotice failure={action.failure} />
        </div>
      )}
      {done && (
        <div className="md:col-span-3">
          <Notice tone="success">{t.common.saved}</Notice>
        </div>
      )}
      <div>
        <Button type="submit" size="sm" busy={action.busy}>
          {text.action.addRecording}
        </Button>
      </div>
    </form>
  );
}

export function ClassGroupEnrollments({ data }: { readonly data: AdminClassGroup }) {
  const text = useAdminText();
  const { t, date } = useWorkspace();
  const group = data.classGroup;
  const names = usePeopleNames();
  const { state, reload } = useApi<Enrollments>(adminApi.enrollments(group.id));
  const [learnerUid, setLearnerUid] = useState("");
  const [activate, setActivate] = useState(true);
  const action = useAction();

  async function enroll(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.enrollments(group.id), "POST", { learnerUid, activate });
    if (result.ok) {
      setLearnerUid("");
      reload();
    }
  }

  return (
    <>
      <Section title={text.action.enroll}>
        <form onSubmit={enroll} className="flex flex-wrap items-end gap-3 rounded-md border p-3">
          <Field label={text.field.learner} htmlFor="enroll-learner">
            <PersonSelect id="enroll-learner" role="student" value={learnerUid} onChange={setLearnerUid} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
            {text.field.activate}
          </label>
          <Button type="submit" busy={action.busy}>
            {text.action.enroll}
          </Button>
          {action.failure && <FailureNotice failure={action.failure} onRetry={reload} />}
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState>{text.classGroup.noEnrollments}</EmptyState>
          ) : (
            <ul className="space-y-3">
              {rows.map((enrollment) => (
                <li key={enrollment.id} className="space-y-2 rounded-md border p-3">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{displayName(names.get(enrollment.learnerUid), t.common.unnamed)}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge tone={enrollment.state === "active" ? "strong" : "neutral"}>{text.state.enrollment[enrollment.state]}</Badge>
                      {date(enrollment.createdAt)}
                    </span>
                  </p>
                  {(ENROLLMENT_NEXT[enrollment.state] ?? []).length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">{text.action.changeStatus}</summary>
                      <div className="mt-2">
                        <StateChange url={adminApi.enrollment(enrollment.id)} states={ENROLLMENT_NEXT[enrollment.state]} labels={text.state.enrollment} revision={enrollment.revision} onChanged={reload} reasonOptional={["active"]} />
                      </div>
                    </details>
                  )}
                  {enrollment.state === "active" && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">{text.action.recordCompletion}</summary>
                      <RecordCompletion enrollmentId={enrollment.id} revision={enrollment.revision} onDone={reload} />
                    </details>
                  )}
                  {enrollment.state === "completed" && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">{text.classGroup.certificates}</summary>
                      <CertificatePanel enrollmentId={enrollment.id} />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>
    </>
  );
}

function RecordCompletion({ enrollmentId, revision, onDone }: { readonly enrollmentId: string; readonly revision: number; readonly onDone: () => void }) {
  const text = useAdminText();
  const [overrideReason, setOverrideReason] = useState("");
  const action = useAction();
  const id = `completion-${enrollmentId}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.completion(enrollmentId), "POST", { overrideReason: overrideReason || undefined, expectedRevision: revision });
    if (result.ok) onDone();
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <Field label={text.field.overrideReason} htmlFor={`${id}-override`} optional>
        <TextInput id={`${id}-override`} maxLength={2000} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
      </Field>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onDone} />}
      <Button type="submit" size="sm" busy={action.busy}>
        {text.action.recordCompletion}
      </Button>
    </form>
  );
}

function CertificatePanel({ enrollmentId }: { readonly enrollmentId: string }) {
  const text = useAdminText();
  const { t, date } = useWorkspace();
  const { state, reload } = useApi<Eligibility>(adminApi.certificate(enrollmentId));
  const action = useAction();

  async function issue() {
    const result = await action.run(adminApi.certificate(enrollmentId), "POST", {});
    if (result.ok) reload();
  }

  return (
    <div className="mt-2">
      <ApiView state={state} onRetry={reload}>
        {(view) => (
          <div className="space-y-3">
            <Notice tone={view.eligibility.eligible ? "success" : "warning"}>{view.eligibility.eligible ? text.classGroup.eligible : text.classGroup.notEligible}</Notice>
            <KeyValues
              items={view.eligibility.checks.map((check) => ({
                label: text.classGroup.check[check.criterion],
                value: <Badge tone={check.met ? "strong" : "warning"}>{check.met ? t.classGroup.met : t.classGroup.notMet}</Badge>,
              }))}
            />
            {view.completionRevoked && <Notice tone="warning">{text.classGroup.completionRevoked}</Notice>}
            {view.completionId && !view.completionRevoked && (
              <ReasonCommand label={text.action.revokeCompletion} url={adminApi.revokeCompletion(view.completionId)} body={{ action: "revoke" }} onDone={reload} />
            )}
            <DataTable
              caption={text.classGroup.certificates}
              rows={view.certificates}
              rowKey={(row) => row.id}
              empty={text.classGroup.noCertificates}
              columns={[
                { key: "code", header: t.certificates.code, cell: (row) => <code dir="ltr">{row.code}</code> },
                { key: "issued", header: t.certificates.issued, cell: (row) => date(row.issuedAt) },
                { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "issued" ? "strong" : "warning"}>{t.certificates.state[row.state]}</Badge> },
                { key: "revoke", header: <span className="sr-only">{text.action.revokeCertificate}</span>, cell: (row) => (row.state === "issued" ? <ReasonCommand label={text.action.revokeCertificate} url={adminApi.revokeCertificate(row.id)} body={{ action: "revoke" }} onDone={reload} /> : null) },
              ]}
            />
            {view.eligibility.eligible && !view.certificates.some((c) => c.state === "issued") && (
              <Button type="button" busy={action.busy} onClick={() => void issue()}>
                {text.action.issueCertificate}
              </Button>
            )}
            {action.failure && <FailureNotice failure={action.failure} onRetry={reload} />}
          </div>
        )}
      </ApiView>
    </div>
  );
}

export function ClassGroupAssignments({ data }: { readonly data: AdminClassGroup }) {
  const text = useAdminText();
  const { t, sessionTime } = useWorkspace();
  const group = data.classGroup;
  const { state, reload } = useApi<AssignmentList>(participantApi.assignments(group.id));
  const assessments = useApi<Assessments>(adminApi.assessments(group.courseId));
  const [assessmentId, setAssessmentId] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.classAssignments(group.id), "POST", { assessmentId, opensAt: localToIso(opensAt), dueAt: localToIso(dueAt) });
    if (result.ok) {
      setOpensAt("");
      setDueAt("");
      reload();
    }
  }

  return (
    <>
      <Section title={text.action.assignAssessment}>
        <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
          <Field label={text.field.assessment} htmlFor="assign-assessment">
            <SelectInput id="assign-assessment" required value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">{t.common.choose}</option>
              {(assessments.state.status === "ready" ? assessments.state.data : []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.opensAt} htmlFor="assign-opens">
            <TextInput id="assign-opens" type="datetime-local" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </Field>
          <Field label={text.field.dueAt} htmlFor="assign-due" optional>
            <TextInput id="assign-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </Field>
          {action.failure && (
            <div className="md:col-span-3">
              <FailureNotice failure={action.failure} onRetry={reload} />
            </div>
          )}
          <div>
            <Button type="submit" busy={action.busy}>
              {text.action.assignAssessment}
            </Button>
          </div>
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={text.classGroup.tabs.assignments}
            rows={rows.filter((row): row is Extract<AssignmentList[number], { attemptsByState: unknown }> => "attemptsByState" in row)}
            rowKey={(row) => row.assignment.id}
            empty={t.classGroup.assignmentsEmpty}
            columns={[
              { key: "title", header: text.field.title, cell: (row) => <TextLink href={pages.assignment(row.assignment.id)}>{row.assignment.title}</TextLink> },
              { key: "opens", header: text.field.opensAt, cell: (row) => sessionTime(row.assignment.opensAt) },
              { key: "state", header: text.field.state, cell: (row) => <Badge>{row.assignment.state}</Badge> },
              {
                key: "cancel",
                header: <span className="sr-only">{text.action.cancelAssignment}</span>,
                cell: (row) => (row.assignment.state === "active" ? <ReasonCommand label={text.action.cancelAssignment} url={adminApi.assignment(row.assignment.id)} body={{ action: "cancel", expectedRevision: row.assignment.revision }} onDone={reload} /> : null),
              },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}

export function ClassGroupRecordings({ data }: { readonly data: AdminClassGroup }) {
  const text = useAdminText();
  const { date, t } = useWorkspace();
  const { state, reload } = useApi<StaffRecordings>(participantApi.recordings(data.classGroup.id));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState>{t.classGroup.recordingsEmpty}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {rows.map((recording) => (
              <li key={recording.id} className="space-y-2 rounded-md border p-3">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <TextLink href={pages.recording(recording.id)}>{recording.title}</TextLink>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    {recording.state && <Badge>{text.state.recording[recording.state as keyof typeof text.state.recording] ?? recording.state}</Badge>}
                    {recording.publishedAt && date(recording.publishedAt)}
                  </span>
                </p>
                {recording.state && typeof recording.revision === "number" && (RECORDING_NEXT[recording.state] ?? []).length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{text.action.changeStatus}</summary>
                    <div className="mt-2">
                      <StateChange url={adminApi.recording(recording.id)} states={RECORDING_NEXT[recording.state]} labels={text.state.recording} revision={recording.revision} onChanged={reload} reasonOptional={["in_review", "published", "processing"]} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )
      }
    </ApiView>
  );
}
