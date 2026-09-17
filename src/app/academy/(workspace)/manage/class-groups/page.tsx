"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { ClassGroups, Courses, Curriculum } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, DataTable, FailureNotice, Field, PageHeader, Section, SelectInput, TextInput, TextLink } from "@/components/academy/workspace/ui";

// Class groups: list (optionally per course) and create one pinned to a published curriculum version.
export default function ClassGroupsPage() {
  const text = useAdminText();
  const { t, date } = useWorkspace();
  const courses = useApi<Courses>(adminApi.courses());
  const [courseFilter, setCourseFilter] = useState("");
  const groups = useApi<ClassGroups>(adminApi.classGroups(courseFilter || undefined));
  const courseTitles = new Map(courses.state.status === "ready" ? courses.state.data.map((c) => [c.id, c.title]) : []);

  return (
    <>
      <PageHeader title={text.classGroup.title} />
      <CreateClassGroup courses={courses.state.status === "ready" ? courses.state.data.filter((c) => c.deletedAt === null) : []} onCreated={groups.reload} />
      <Section title={text.classGroup.title}>
        <div className="mb-3 max-w-sm">
          <Field label={text.field.course} htmlFor="class-group-course-filter">
            <SelectInput id="class-group-course-filter" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">{t.common.all}</option>
              {[...courseTitles].map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <ApiView state={groups.state} onRetry={groups.reload}>
          {(rows) => (
            <DataTable
              caption={text.classGroup.title}
              rows={rows}
              rowKey={(row) => row.id}
              empty={text.classGroup.noClassGroups}
              columns={[
                { key: "name", header: text.field.name, cell: (row) => <TextLink href={managePages.classGroup(row.id)}>{row.name}</TextLink> },
                { key: "course", header: text.field.course, cell: (row) => courseTitles.get(row.courseId) ?? "—" },
                { key: "state", header: text.field.state, cell: (row) => <Badge>{t.classGroup.status[row.status]}</Badge> },
                { key: "dates", header: text.field.startsOn, cell: (row) => [date(row.startsOn), date(row.endsOn)].filter(Boolean).join(" – ") || "—" },
              ]}
            />
          )}
        </ApiView>
      </Section>
    </>
  );
}

function CreateClassGroup({ courses, onCreated }: { readonly courses: Courses; readonly onCreated: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [courseId, setCourseId] = useState("");
  const curriculum = useApi<Curriculum>(courseId ? adminApi.curriculum(courseId) : null);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const action = useAction();
  const published = courseId && curriculum.state.status === "ready" ? curriculum.state.data.versions.find((v) => v.state === "published") : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.classGroups(), "POST", {
      courseId,
      curriculumVersionId: published?.id,
      name,
      capacity: capacity ? Number(capacity) : undefined,
      startsOn: startsOn || undefined,
      endsOn: endsOn || undefined,
    });
    if (result.ok) {
      setName("");
      onCreated();
    }
  }

  return (
    <details className="mb-6 rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.classGroup.newClassGroup}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={text.field.course} htmlFor="new-group-course">
          <SelectInput id="new-group-course" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">{t.common.choose}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={text.field.curriculumVersion} htmlFor="new-group-version">
          <TextInput id="new-group-version" readOnly value={published ? `v${published.versionNumber}` : courseId ? text.course.noPublished : ""} />
        </Field>
        <Field label={text.field.name} htmlFor="new-group-name">
          <TextInput id="new-group-name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={text.field.capacity} htmlFor="new-group-capacity" optional>
          <TextInput id="new-group-capacity" type="number" min={1} max={10000} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <Field label={text.field.startsOn} htmlFor="new-group-starts" optional>
          <TextInput id="new-group-starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </Field>
        <Field label={text.field.endsOn} htmlFor="new-group-ends" optional>
          <TextInput id="new-group-ends" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </Field>
        {action.failure && (
          <div className="md:col-span-2">
            <FailureNotice failure={action.failure} />
          </div>
        )}
        <div>
          <Button type="submit" busy={action.busy} disabled={!published}>
            {text.action.create}
          </Button>
        </div>
      </form>
    </details>
  );
}
