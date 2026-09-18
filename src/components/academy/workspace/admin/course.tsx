"use client";

import { useState, type FormEvent } from "react";
import { ASSESSMENT_MODES } from "@/lib/academy/domain/vocabulary";
import { useAction, useApi } from "../api";
import { useWorkspace } from "../context";
import { ApiView, Badge, Button, DataTable, EmptyState, FailureNotice, Field, Section, SelectInput, TextInput, TextLink } from "../ui";
import { adminApi } from "./api-paths";
import { EditTitle, StateBadge } from "./common";
import { managePages, ReasonCommand, StateChange, useAdminText } from "./kit";
import type { Assessments, ClassGroups, CourseDetail, CourseResources, Curriculum, CurriculumVersionDetail, Offers, Programs, RemediationRules } from "./types";

const CATALOG_NEXT: Readonly<Record<string, readonly string[]>> = { draft: ["active"], active: ["retired"], retired: ["active"] };

export function CourseDetails({ detail, onChanged }: { readonly detail: CourseDetail; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { course } = detail;
  return (
    <>
      <Section title={text.action.save}>
        <EditTitle key={course.revision} url={adminApi.course(course.id)} title={course.title} description={course.description} revision={course.revision} onSaved={onChanged} />
      </Section>
      <Section title={text.action.changeStatus}>
        <p className="mb-2">
          <StateBadge state={course.status} deleted={course.deletedAt !== null} />
        </p>
        <StateChange url={adminApi.course(course.id)} states={CATALOG_NEXT[course.status] ?? []} labels={text.state.catalog} revision={course.revision} onChanged={onChanged} />
      </Section>
      <Section title={text.action.moveProgram}>
        <MoveProgram courseId={course.id} programId={course.programId} revision={course.revision} onMoved={onChanged} />
      </Section>
      <Section title={course.deletedAt ? text.action.restore : text.action.delete}>
        {course.deletedAt ? (
          <ReasonCommand label={text.action.restore} url={adminApi.course(course.id)} body={{ action: "restore", expectedRevision: course.revision }} onDone={onChanged} variant="primary" />
        ) : (
          <ReasonCommand label={text.action.delete} url={adminApi.course(course.id)} body={{ action: "delete", expectedRevision: course.revision }} onDone={onChanged} />
        )}
      </Section>
    </>
  );
}

function MoveProgram({ courseId, programId, revision, onMoved }: { readonly courseId: string; readonly programId: string | null; readonly revision: number; readonly onMoved: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const programs = useApi<Programs>(adminApi.programs());
  const [target, setTarget] = useState(programId ?? "");
  const [reason, setReason] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.course(courseId), "PATCH", { action: "move_program", programId: target || null, reason, expectedRevision: revision });
    if (result.ok) onMoved();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
      <Field label={text.field.program} htmlFor="move-program">
        <SelectInput id="move-program" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{text.field.noProgram}</option>
          {(programs.state.status === "ready" ? programs.state.data : []).map((program) => (
            <option key={program.id} value={program.id}>
              {program.title}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t.common.reason} htmlFor="move-reason">
        <TextInput id="move-reason" required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {action.failure && (
        <div className="md:col-span-2">
          <FailureNotice failure={action.failure} onRetry={onMoved} />
        </div>
      )}
      <div>
        <Button type="submit" size="sm" busy={action.busy}>
          {text.action.moveProgram}
        </Button>
      </div>
    </form>
  );
}

/** The course's curriculum versions and the published outline's lessons (for Lesson Script authoring). */
export function CourseCurriculum({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const { dateTime } = useWorkspace();
  const { state, reload } = useApi<Curriculum>(adminApi.curriculum(courseId));
  const action = useAction();

  async function newDraft() {
    const result = await action.run(adminApi.curriculum(courseId), "POST", { action: "create_draft" });
    if (result.ok) reload();
  }

  return (
    <ApiView state={state} onRetry={reload}>
      {(curriculum) => {
        const published = curriculum.versions.find((v) => v.state === "published");
        return (
          <>
            <Section title={text.course.versions} actions={<Button type="button" size="sm" busy={action.busy} onClick={() => void newDraft()}>{text.action.newDraft}</Button>}>
              {action.failure && <FailureNotice failure={action.failure} onRetry={reload} />}
              <DataTable
                caption={text.course.versions}
                rows={[...curriculum.versions].sort((a, b) => b.versionNumber - a.versionNumber)}
                rowKey={(row) => row.id}
                empty={text.course.noVersions}
                columns={[
                  { key: "number", header: text.field.version, cell: (row) => <TextLink href={managePages.curriculumVersion(row.id)}>{`v${row.versionNumber}`}</TextLink> },
                  { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "published" ? "strong" : "neutral"}>{text.state.version[row.state]}</Badge> },
                  { key: "updated", header: text.field.updated, cell: (row) => dateTime(row.updatedAt) },
                ]}
              />
            </Section>
            <Section title={text.course.lessons}>{published ? <PublishedLessons versionId={published.id} /> : <EmptyState>{text.course.noPublished}</EmptyState>}</Section>
          </>
        );
      }}
    </ApiView>
  );
}

function PublishedLessons({ versionId }: { readonly versionId: string }) {
  const text = useAdminText();
  const { state, reload } = useApi<CurriculumVersionDetail>(adminApi.curriculumVersion(versionId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(detail) => (
        <ol className="space-y-3">
          {detail.outline.units.map((unit) => (
            <li key={unit.unitId} className="rounded-md border p-3">
              <p className="font-medium">{unit.title}</p>
              <ul className="mt-2 space-y-1 ps-4 text-sm">
                {unit.lessons.map((lesson) => (
                  <li key={lesson.lessonId} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{lesson.title}</span>
                    <TextLink href={managePages.lessonScript(lesson.lessonId)}>{text.course.script}</TextLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </ApiView>
  );
}

export function CourseAssessments({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const { state, reload } = useApi<Assessments>(adminApi.assessments(courseId));
  const [mode, setMode] = useState<string>("quiz");
  const [title, setTitle] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.assessments(), "POST", { courseId, mode, title });
    if (result.ok) {
      setTitle("");
      reload();
    }
  }

  return (
    <>
      <Section title={text.course.newAssessment}>
        <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_12rem_auto] md:items-end">
          <Field label={text.field.title} htmlFor="assessment-title">
            <TextInput id="assessment-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={text.field.mode} htmlFor="assessment-mode">
            <SelectInput id="assessment-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
              {ASSESSMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {text.assessmentEditor.mode[m]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button type="submit" busy={action.busy}>
            {text.action.create}
          </Button>
          {action.failure && (
            <div className="md:col-span-3">
              <FailureNotice failure={action.failure} />
            </div>
          )}
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={text.course.tabs.assessments}
            rows={rows}
            rowKey={(row) => row.id}
            empty={text.course.noAssessments}
            columns={[
              { key: "title", header: text.field.title, cell: (row) => <TextLink href={managePages.assessment(row.id)}>{row.title}</TextLink> },
              { key: "mode", header: text.field.mode, cell: (row) => text.assessmentEditor.mode[row.mode] },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}

export function CourseReadings({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const { t, fmt } = useWorkspace();
  const { state, reload } = useApi<CourseResources>(adminApi.resources(courseId));
  const [bookId, setBookId] = useState("");
  const [purpose, setPurpose] = useState<"required" | "recommended">("required");
  const [pagesFrom, setPagesFrom] = useState("");
  const [pagesTo, setPagesTo] = useState("");
  const [note, setNote] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.resources(courseId), "POST", {
      libraryBookId: bookId.trim(),
      purpose,
      pagesFrom: pagesFrom ? Number(pagesFrom) : undefined,
      pagesTo: pagesTo ? Number(pagesTo) : undefined,
      note: note || undefined,
    });
    if (result.ok) {
      setBookId("");
      setPagesFrom("");
      setPagesTo("");
      setNote("");
      reload();
    }
  }

  return (
    <>
      <Section title={text.action.addReading}>
        <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
          <Field label={text.field.book} htmlFor="reading-book">
            <TextInput id="reading-book" required dir="ltr" value={bookId} onChange={(e) => setBookId(e.target.value)} />
          </Field>
          <Field label={text.field.purpose} htmlFor="reading-purpose">
            <SelectInput id="reading-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as "required" | "recommended")}>
              <option value="required">{t.classGroup.purpose.required}</option>
              <option value="recommended">{t.classGroup.purpose.recommended}</option>
            </SelectInput>
          </Field>
          <Field label={text.field.note} htmlFor="reading-note" optional>
            <TextInput id="reading-note" maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label={text.field.pagesFrom} htmlFor="reading-from" optional>
            <TextInput id="reading-from" type="number" min={1} value={pagesFrom} onChange={(e) => setPagesFrom(e.target.value)} />
          </Field>
          <Field label={text.field.pagesTo} htmlFor="reading-to" optional>
            <TextInput id="reading-to" type="number" min={1} value={pagesTo} onChange={(e) => setPagesTo(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" busy={action.busy}>
              {text.action.addReading}
            </Button>
          </div>
          {action.failure && (
            <div className="md:col-span-3">
              <FailureNotice failure={action.failure} />
            </div>
          )}
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={text.course.tabs.readings}
            rows={rows}
            rowKey={(row) => row.id}
            empty={text.course.noReadings}
            columns={[
              { key: "book", header: text.field.book, cell: (row) => <code dir="ltr" className="break-all">{row.libraryBookId}</code> },
              { key: "purpose", header: text.field.purpose, cell: (row) => t.classGroup.purpose[row.purpose] },
              { key: "pages", header: t.classGroup.wholeBook, cell: (row) => (row.pagesFrom ? fmt(t.classGroup.pages, { from: row.pagesFrom, to: row.pagesTo ?? row.pagesFrom }) : t.classGroup.wholeBook) },
              { key: "remove", header: <span className="sr-only">{text.action.removeReading}</span>, cell: (row) => <ReasonCommand label={text.action.removeReading} url={adminApi.resource(row.id)} body={{ action: "remove", expectedRevision: row.revision }} onDone={reload} /> },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}

export function CourseRemediationRules({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const rules = useApi<RemediationRules>(adminApi.remediationRules(courseId));
  const assessments = useApi<Assessments>(adminApi.assessments(courseId));
  const [assessmentId, setAssessmentId] = useState("");
  const [itemId, setItemId] = useState("");
  const [below, setBelow] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  const { t } = useWorkspace();
  const titles = new Map(assessments.state.status === "ready" ? assessments.state.data.map((a) => [a.id, a.title]) : []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.remediationRules(courseId), "POST", { assessmentId, itemId: itemId.trim(), belowScorePercent: Number(below), reason });
    if (result.ok) {
      setItemId("");
      setBelow("");
      setReason("");
      rules.reload();
    }
  }

  return (
    <>
      <Section title={text.action.addRule}>
        <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
          <Field label={text.field.assessment} htmlFor="rule-assessment">
            <SelectInput id="rule-assessment" required value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)}>
              <option value="">{t.common.choose}</option>
              {(assessments.state.status === "ready" ? assessments.state.data : []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.item} htmlFor="rule-item">
            <TextInput id="rule-item" required dir="ltr" value={itemId} onChange={(e) => setItemId(e.target.value)} />
          </Field>
          <Field label={text.field.belowScore} htmlFor="rule-below">
            <TextInput id="rule-below" required type="number" min={1} max={100} value={below} onChange={(e) => setBelow(e.target.value)} />
          </Field>
          <Field label={t.common.reason} htmlFor="rule-reason">
            <TextInput id="rule-reason" required maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {action.failure && (
            <div className="md:col-span-2">
              <FailureNotice failure={action.failure} />
            </div>
          )}
          <div>
            <Button type="submit" busy={action.busy}>
              {text.action.addRule}
            </Button>
          </div>
        </form>
      </Section>
      <ApiView state={rules.state} onRetry={rules.reload}>
        {(rows) => (
          <DataTable
            caption={text.course.tabs.remediation}
            rows={rows}
            rowKey={(row) => row.id}
            empty={text.course.noRules}
            columns={[
              { key: "assessment", header: text.field.assessment, cell: (row) => titles.get(row.assessmentId) ?? row.assessmentId },
              { key: "below", header: text.field.belowScore, cell: (row) => `${row.belowScorePercent}%` },
              { key: "item", header: text.field.item, cell: (row) => <TextLink href={managePages.productionItem(row.itemId)}>{row.itemId.slice(0, 8)}</TextLink> },
              { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "active" ? "strong" : "neutral"}>{row.state}</Badge> },
              { key: "retire", header: <span className="sr-only">{text.action.retireRule}</span>, cell: (row) => (row.state === "active" ? <ReasonCommand label={text.action.retireRule} url={adminApi.remediationRule(row.id)} body={{ action: "retire", expectedRevision: row.revision }} onDone={rules.reload} /> : null) },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}

export function CourseClassGroups({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const { date, t } = useWorkspace();
  const { state, reload } = useApi<ClassGroups>(adminApi.classGroups(courseId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(rows) => (
        <DataTable
          caption={text.course.tabs.classGroups}
          rows={rows}
          rowKey={(row) => row.id}
          empty={text.course.noClassGroups}
          columns={[
            { key: "name", header: text.field.name, cell: (row) => <TextLink href={managePages.classGroup(row.id)}>{row.name}</TextLink> },
            { key: "state", header: text.field.state, cell: (row) => <Badge>{t.classGroup.status[row.status]}</Badge> },
            { key: "dates", header: text.field.startsOn, cell: (row) => [date(row.startsOn), date(row.endsOn)].filter(Boolean).join(" – ") || "—" },
          ]}
        />
      )}
    </ApiView>
  );
}

/**
 * Whop offers: one Whop plan sells places in one class group. Administrators
 * map them here; learners are enrolled only by verified Whop payments.
 */
export function CourseOffers({ courseId }: { readonly courseId: string }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const offers = useApi<Offers>(adminApi.offers(courseId));
  const groups = useApi<ClassGroups>(adminApi.classGroups(courseId));
  const [classGroupId, setClassGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const [label, setLabel] = useState("");
  const action = useAction();
  const names = new Map(groups.state.status === "ready" ? groups.state.data.map((g) => [g.id, g.name]) : []);
  const sellable = groups.state.status === "ready" ? groups.state.data.filter((g) => g.status === "planned" || g.status === "active") : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.offers(courseId), "POST", { classGroupId, planId: planId.trim(), label });
    if (result.ok) {
      setPlanId("");
      setLabel("");
      offers.reload();
    }
  }

  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{text.course.offersIntro}</p>
      <Section title={text.action.addOffer}>
        <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
          <Field label={text.field.classGroup} htmlFor="offer-class-group">
            <SelectInput id="offer-class-group" required value={classGroupId} onChange={(e) => setClassGroupId(e.target.value)}>
              <option value="">{t.common.choose}</option>
              {sellable.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.planId} htmlFor="offer-plan">
            <TextInput id="offer-plan" required dir="ltr" pattern="plan_[A-Za-z0-9]{1,64}" placeholder="plan_..." value={planId} onChange={(e) => setPlanId(e.target.value)} />
          </Field>
          <Field label={text.field.offerLabel} htmlFor="offer-label">
            <TextInput id="offer-label" required maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {action.failure && (
            <div className="md:col-span-3">
              <FailureNotice failure={action.failure} />
            </div>
          )}
          <div>
            <Button type="submit" busy={action.busy}>
              {text.action.addOffer}
            </Button>
          </div>
        </form>
      </Section>
      <ApiView state={offers.state} onRetry={offers.reload}>
        {(rows) => (
          <DataTable
            caption={text.course.tabs.offers}
            rows={rows}
            rowKey={(row) => row.id}
            empty={text.course.noOffers}
            columns={[
              { key: "label", header: text.field.offerLabel, cell: (row) => row.label },
              { key: "group", header: text.field.classGroup, cell: (row) => <TextLink href={managePages.classGroup(row.classGroupId)}>{names.get(row.classGroupId) ?? row.classGroupId.slice(0, 8)}</TextLink> },
              { key: "plan", header: text.field.planId, cell: (row) => <span dir="ltr" className="font-mono text-xs">{row.providerPlanId}</span> },
              { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "active" ? "strong" : "neutral"}>{row.state}</Badge> },
              { key: "retire", header: <span className="sr-only">{text.action.retireRule}</span>, cell: (row) => (row.state === "active" ? <ReasonCommand label={text.action.retireRule} url={adminApi.offer(row.id)} body={{ action: "retire", expectedRevision: row.revision }} onDone={offers.reload} /> : null) },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}
