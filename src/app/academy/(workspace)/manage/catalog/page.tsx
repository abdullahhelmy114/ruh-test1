"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Courses, Programs } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { StateBadge } from "@/components/academy/workspace/admin/common";
import { ApiView, Button, DataTable, FailureNotice, Field, PageHeader, Section, SelectInput, TextArea, TextInput, TextLink } from "@/components/academy/workspace/ui";

// Programs and courses: list, create, and open for editing.
export default function CatalogPage() {
  const text = useAdminText();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const programs = useApi<Programs>(adminApi.programs(includeDeleted));
  const courses = useApi<Courses>(adminApi.courses(includeDeleted));
  const programNames = new Map(programs.state.status === "ready" ? programs.state.data.map((p) => [p.id, p.title]) : []);

  return (
    <>
      <PageHeader
        title={text.catalog.title}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            {text.field.includeDeleted}
          </label>
        }
      />
      <Section title={text.catalog.programs}>
        <CreateProgram onCreated={programs.reload} />
        <div className="mt-4">
          <ApiView state={programs.state} onRetry={programs.reload}>
            {(rows) => (
              <DataTable
                caption={text.catalog.programs}
                rows={rows}
                rowKey={(row) => row.id}
                empty={text.catalog.noPrograms}
                columns={[
                  { key: "title", header: text.field.title, cell: (row) => <TextLink href={managePages.program(row.id)}>{row.title}</TextLink> },
                  { key: "slug", header: text.field.slug, cell: (row) => <code dir="ltr">{row.slug}</code> },
                  { key: "state", header: text.field.state, cell: (row) => <StateBadge state={row.status} deleted={row.deletedAt !== null} /> },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>
      <Section title={text.catalog.courses}>
        <CreateCourse programs={programs.state.status === "ready" ? programs.state.data.filter((p) => p.deletedAt === null) : []} onCreated={courses.reload} />
        <div className="mt-4">
          <ApiView state={courses.state} onRetry={courses.reload}>
            {(rows) => (
              <DataTable
                caption={text.catalog.courses}
                rows={rows}
                rowKey={(row) => row.id}
                empty={text.catalog.noCourses}
                columns={[
                  { key: "title", header: text.field.title, cell: (row) => <TextLink href={managePages.course(row.id)}>{row.title}</TextLink> },
                  { key: "program", header: text.field.program, cell: (row) => (row.programId ? (programNames.get(row.programId) ?? "—") : text.field.noProgram) },
                  { key: "slug", header: text.field.slug, cell: (row) => <code dir="ltr">{row.slug}</code> },
                  { key: "state", header: text.field.state, cell: (row) => <StateBadge state={row.status} deleted={row.deletedAt !== null} /> },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>
    </>
  );
}

function CreateProgram({ onCreated }: { readonly onCreated: () => void }) {
  const text = useAdminText();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.programs(), "POST", { slug, title, description: description || undefined });
    if (result.ok) {
      setSlug("");
      setTitle("");
      setDescription("");
      onCreated();
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.catalog.newProgram}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={text.field.title} htmlFor="program-title">
          <TextInput id="program-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.field.slug} htmlFor="program-slug">
          <TextInput id="program-slug" required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label={text.field.description} htmlFor="program-description" optional>
            <TextArea id="program-description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {action.failure && (
          <div className="md:col-span-2">
            <FailureNotice failure={action.failure} />
          </div>
        )}
        <div>
          <Button type="submit" busy={action.busy}>
            {text.action.create}
          </Button>
        </div>
      </form>
    </details>
  );
}

function CreateCourse({ programs, onCreated }: { readonly programs: Programs; readonly onCreated: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [programId, setProgramId] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.courses(), "POST", { programId: programId || undefined, slug, title, description: description || undefined });
    if (result.ok) {
      setSlug("");
      setTitle("");
      setDescription("");
      onCreated();
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.catalog.newCourse}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={text.field.title} htmlFor="course-title">
          <TextInput id="course-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.field.slug} htmlFor="course-slug">
          <TextInput id="course-slug" required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label={text.field.program} htmlFor="course-program" optional>
          <SelectInput id="course-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
            <option value="">{text.field.noProgram}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="md:col-span-2">
          <Field label={text.field.description} htmlFor="course-description" optional>
            <TextArea id="course-description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {action.failure && (
          <div className="md:col-span-2">
            <FailureNotice failure={action.failure} />
          </div>
        )}
        <div>
          <Button type="submit" busy={action.busy}>
            {text.action.create}
          </Button>
          <span className="sr-only">{t.common.optional}</span>
        </div>
      </form>
    </details>
  );
}
