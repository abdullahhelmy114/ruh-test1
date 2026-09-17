"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, StateChange, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Courses, Factories, Items, Libraries, ProductionReport, Programs, Runs } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, Card, DataTable, FailureNotice, Field, Notice, PageHeader, Section, SelectInput, TextArea, TextInput, TextLink } from "@/components/academy/workspace/ui";
import { CONTENT_KINDS } from "@/lib/academy/production/content";

const RUN_NEXT: Readonly<Record<string, readonly string[]>> = {
  planned: ["in_production", "cancelled"],
  in_production: ["awaiting_review", "cancelled"],
  awaiting_review: ["in_production", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// 2C production: libraries, factories, runs and content items. Nothing here
// runs external tools or publishes automatically.
export default function ProductionPage() {
  const text = useAdminText();
  const report = useApi<ProductionReport>(adminApi.productionReport);
  const libraries = useApi<Libraries>(adminApi.libraries);
  const factories = useApi<Factories>(adminApi.factories);
  const runs = useApi<Runs>(adminApi.runs);
  const items = useApi<Items>(adminApi.items);
  const libraryTitles = new Map(libraries.state.status === "ready" ? libraries.state.data.map((l) => [l.id, l.title]) : []);
  const factoryTitles = new Map(factories.state.status === "ready" ? factories.state.data.map((f) => [f.id, f.title]) : []);

  return (
    <>
      <PageHeader title={text.production.title} />
      <Notice>{text.production.guard}</Notice>

      <Section title={text.nav.overview} className="mt-6">
        <ApiView state={report.state} onRetry={report.reload}>
          {(data) => (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <p className="text-sm text-muted-foreground">{text.production.report.versionsInReview}</p>
                <p className="text-2xl font-semibold">{data.versionsInReview}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">{text.production.report.versionsAwaitingRights}</p>
                <p className="text-2xl font-semibold">{data.versionsAwaitingRights}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">{text.production.report.openRemediation}</p>
                <p className="text-2xl font-semibold">{data.openRemediation}</p>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">{text.production.report.itemsByKind}</p>
                <ul className="mt-1 text-sm">
                  {Object.entries(data.itemsByKind as Record<string, number>).map(([kind, count]) => (
                    <li key={kind}>
                      {text.production.kind[kind as keyof typeof text.production.kind] ?? kind}: {count}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <p className="text-sm text-muted-foreground">{text.production.report.runsByState}</p>
                <ul className="mt-1 text-sm">
                  {Object.entries(data.runsByState as Record<string, number>).map(([state, count]) => (
                    <li key={state}>
                      {text.state.run[state as keyof typeof text.state.run] ?? state}: {count}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </ApiView>
      </Section>

      <Section title={text.production.items}>
        <CreateItem libraries={libraries.state.status === "ready" ? libraries.state.data : []} runs={runs.state.status === "ready" ? runs.state.data : []} onCreated={items.reload} />
        <div className="mt-3">
          <ApiView state={items.state} onRetry={items.reload}>
            {(rows) => (
              <DataTable
                caption={text.production.items}
                rows={rows}
                rowKey={(row) => row.id}
                empty={text.production.noItems}
                columns={[
                  { key: "title", header: text.field.title, cell: (row) => <TextLink href={managePages.productionItem(row.id)}>{row.title}</TextLink> },
                  { key: "kind", header: text.field.kind, cell: (row) => text.production.kind[row.kind] },
                  { key: "library", header: text.field.library, cell: (row) => libraryTitles.get(row.libraryId) ?? "—" },
                  {
                    key: "state",
                    header: text.production.latest,
                    cell: (row) => (
                      <span className="flex flex-wrap gap-1">
                        {row.latestState && <Badge>{text.state.version[row.latestState as keyof typeof text.state.version] ?? row.latestState}</Badge>}
                        {row.hasPublished && <Badge tone="strong">{text.production.published}</Badge>}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>

      <Section title={text.production.runs}>
        <CreateRun factories={factories.state.status === "ready" ? factories.state.data : []} libraries={libraries.state.status === "ready" ? libraries.state.data : []} onCreated={runs.reload} />
        <div className="mt-3">
          <ApiView state={runs.state} onRetry={runs.reload}>
            {(rows) =>
              rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{text.production.noRuns}</p>
              ) : (
                <ul className="space-y-3">
                  {rows.map((run) => (
                    <li key={run.id} className="space-y-2 rounded-md border p-3">
                      <p className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-medium">{run.title}</span>
                          <span className="block text-sm text-muted-foreground">
                            {factoryTitles.get(run.factoryId) ?? "—"} · {libraryTitles.get(run.libraryId) ?? "—"}
                          </span>
                        </span>
                        <Badge>{text.state.run[run.state]}</Badge>
                      </p>
                      {(RUN_NEXT[run.state] ?? []).length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">{text.action.changeStatus}</summary>
                          <div className="mt-2">
                            <StateChange url={adminApi.run(run.id)} states={RUN_NEXT[run.state]} labels={text.state.run} revision={run.revision} onChanged={runs.reload} reasonOptional={["in_production", "awaiting_review", "completed"]} />
                          </div>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
              )
            }
          </ApiView>
        </div>
      </Section>

      <Section title={text.production.libraries}>
        <CreateLibrary onCreated={libraries.reload} />
        <div className="mt-3">
          <ApiView state={libraries.state} onRetry={libraries.reload}>
            {(rows) => (
              <DataTable
                caption={text.production.libraries}
                rows={rows}
                rowKey={(row) => row.id}
                empty={text.production.noLibraries}
                columns={[
                  { key: "title", header: text.field.title, cell: (row) => row.title },
                  { key: "slug", header: text.field.slug, cell: (row) => <code dir="ltr">{row.slug}</code> },
                  { key: "scope", header: text.field.scope, cell: (row) => text.production.libraryScope[row.scope] },
                  {
                    key: "state",
                    header: text.field.state,
                    cell: (row) => (
                      <details>
                        <summary className="cursor-pointer">
                          <Badge tone={row.state === "active" ? "strong" : "neutral"}>{text.state.library[row.state]}</Badge>
                        </summary>
                        <div className="mt-2">
                          <StateChange url={adminApi.library(row.id)} states={row.state === "active" ? ["archived"] : ["active"]} labels={text.state.library} revision={row.revision} onChanged={libraries.reload} command="change_state" reasonOptional={["active"]} />
                        </div>
                      </details>
                    ),
                  },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>

      <Section title={text.production.factories}>
        <RegisterFactory onCreated={factories.reload} />
        <div className="mt-3">
          <ApiView state={factories.state} onRetry={factories.reload}>
            {(rows) => (
              <DataTable
                caption={text.production.factories}
                rows={rows}
                rowKey={(row) => row.id}
                empty={text.production.noFactories}
                columns={[
                  { key: "title", header: text.field.title, cell: (row) => row.title },
                  { key: "key", header: text.field.key, cell: (row) => <code dir="ltr">{row.key}</code> },
                  { key: "output", header: text.field.outputKind, cell: (row) => text.production.kind[row.outputKind] },
                ]}
              />
            )}
          </ApiView>
        </div>
      </Section>
    </>
  );
}

function CreateLibrary({ onCreated }: { readonly onCreated: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const programs = useApi<Programs>(adminApi.programs());
  const courses = useApi<Courses>(adminApi.courses());
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"academy" | "program" | "course">("academy");
  const [scopeId, setScopeId] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.libraries, "POST", {
      slug,
      title,
      description: description || undefined,
      scope,
      programId: scope === "program" ? scopeId : undefined,
      courseId: scope === "course" ? scopeId : undefined,
    });
    if (result.ok) {
      setSlug("");
      setTitle("");
      setDescription("");
      onCreated();
    }
  }

  const options = scope === "program" ? (programs.state.status === "ready" ? programs.state.data : []) : scope === "course" ? (courses.state.status === "ready" ? courses.state.data : []) : [];

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.production.newLibrary}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={text.field.title} htmlFor="library-title">
          <TextInput id="library-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.field.slug} htmlFor="library-slug">
          <TextInput id="library-slug" required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </Field>
        <Field label={text.field.scope} htmlFor="library-scope">
          <SelectInput
            id="library-scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as "academy" | "program" | "course");
              setScopeId("");
            }}
          >
            <option value="academy">{text.production.libraryScope.academy}</option>
            <option value="program">{text.production.libraryScope.program}</option>
            <option value="course">{text.production.libraryScope.course}</option>
          </SelectInput>
        </Field>
        {scope !== "academy" && (
          <Field label={scope === "program" ? text.field.program : text.field.course} htmlFor="library-scope-id">
            <SelectInput id="library-scope-id" required value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
              <option value="">{t.common.choose}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </SelectInput>
          </Field>
        )}
        <div className="md:col-span-2">
          <Field label={text.field.description} htmlFor="library-description" optional>
            <TextArea id="library-description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
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

function RegisterFactory({ onCreated }: { readonly onCreated: () => void }) {
  const text = useAdminText();
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [outputKind, setOutputKind] = useState<string>("activity");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.factories, "POST", { key, title, description: description || undefined, outputKind });
    if (result.ok) {
      setKey("");
      setTitle("");
      setDescription("");
      onCreated();
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.production.newFactory}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label={text.field.title} htmlFor="factory-title">
          <TextInput id="factory-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.field.key} htmlFor="factory-key">
          <TextInput id="factory-key" required dir="ltr" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
        <Field label={text.field.outputKind} htmlFor="factory-kind">
          <SelectInput id="factory-kind" value={outputKind} onChange={(e) => setOutputKind(e.target.value)}>
            {CONTENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {text.production.kind[kind]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="md:col-span-3">
          <Field label={text.field.description} htmlFor="factory-description" optional>
            <TextArea id="factory-description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {action.failure && (
          <div className="md:col-span-3">
            <FailureNotice failure={action.failure} />
          </div>
        )}
        <div>
          <Button type="submit" busy={action.busy}>
            {text.production.newFactory}
          </Button>
        </div>
      </form>
    </details>
  );
}

function CreateRun({ factories, libraries, onCreated }: { readonly factories: Factories; readonly libraries: Libraries; readonly onCreated: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [factoryId, setFactoryId] = useState("");
  const [libraryId, setLibraryId] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.runs, "POST", { factoryId, libraryId, title, brief: brief || undefined });
    if (result.ok) {
      setTitle("");
      setBrief("");
      onCreated();
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.production.newRun}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label={text.field.title} htmlFor="run-title">
          <TextInput id="run-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.production.factories} htmlFor="run-factory">
          <SelectInput id="run-factory" required value={factoryId} onChange={(e) => setFactoryId(e.target.value)}>
            <option value="">{t.common.choose}</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={text.field.library} htmlFor="run-library">
          <SelectInput id="run-library" required value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
            <option value="">{t.common.choose}</option>
            {libraries.filter((l) => l.state === "active").map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="md:col-span-3">
          <Field label={text.field.brief} htmlFor="run-brief" optional>
            <TextArea id="run-brief" maxLength={5000} value={brief} onChange={(e) => setBrief(e.target.value)} />
          </Field>
        </div>
        {action.failure && (
          <div className="md:col-span-3">
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

function CreateItem({ libraries, runs, onCreated }: { readonly libraries: Libraries; readonly runs: Runs; readonly onCreated: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [libraryId, setLibraryId] = useState("");
  const [runId, setRunId] = useState("");
  const [kind, setKind] = useState<string>("activity");
  const [title, setTitle] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.items, "POST", { libraryId, runId: runId || undefined, kind, title });
    if (result.ok) {
      setTitle("");
      onCreated();
    }
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.production.newItem}</summary>
      <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label={text.field.title} htmlFor="item-title">
          <TextInput id="item-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={text.field.kind} htmlFor="item-kind">
          <SelectInput id="item-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {CONTENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {text.production.kind[k]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={text.field.library} htmlFor="item-library">
          <SelectInput id="item-library" required value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
            <option value="">{t.common.choose}</option>
            {libraries.filter((l) => l.state === "active").map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={text.field.run} htmlFor="item-run" optional>
          <SelectInput id="item-run" value={runId} onChange={(e) => setRunId(e.target.value)}>
            <option value="">{t.common.none}</option>
            {runs.filter((r) => r.libraryId === libraryId && (r.state === "planned" || r.state === "in_production")).map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </SelectInput>
        </Field>
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
