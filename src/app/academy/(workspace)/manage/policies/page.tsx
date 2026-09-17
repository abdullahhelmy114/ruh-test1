"use client";

import { useId, useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { Saved, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Courses, PolicyMap, Programs } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, Card, FailureNotice, Field, Notice, PageHeader, ReasonField, SelectInput, TextArea } from "@/components/academy/workspace/ui";

type Entry = PolicyMap[number];
type Level = "academy" | "program" | "course";

// Policies: ACADEMY -> PROGRAM -> COURSE. There is no class group level. Each
// value is validated by the server's policy registry; nothing here has defaults.
export default function PoliciesPage() {
  const text = useAdminText();
  const { t } = useWorkspace();
  const programs = useApi<Programs>(adminApi.programs());
  const courses = useApi<Courses>(adminApi.courses());
  const [programId, setProgramId] = useState("");
  const [courseId, setCourseId] = useState("");
  const course = courses.state.status === "ready" ? courses.state.data.find((c) => c.id === courseId) : undefined;
  // A course's effective values include its program's overrides.
  const effectiveProgramId = course?.programId ?? programId;
  const map = useApi<PolicyMap>(adminApi.policies(effectiveProgramId || undefined, courseId || undefined));

  return (
    <>
      <PageHeader title={text.policies.title} intro={text.policies.intro} />
      <Card className="mb-6">
        <p className="mb-2 font-medium">{text.policies.target}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={text.field.program} htmlFor="policy-program">
            <SelectInput id="policy-program" value={programId} disabled={courseId !== ""} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">{text.policies.academy}</option>
              {(programs.state.status === "ready" ? programs.state.data : []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.course} htmlFor="policy-course">
            <SelectInput id="policy-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">{t.common.none}</option>
              {(courses.state.status === "ready" ? courses.state.data : []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </Card>
      <ApiView state={map.state} onRetry={map.reload}>
        {(entries) => (
          <ul className="space-y-4">
            {entries.map((entry) => (
              <li key={`${entry.key}-${effectiveProgramId}-${courseId}`}>
                <PolicyCard entry={entry} programId={effectiveProgramId || null} courseId={courseId || null} onChanged={map.reload} />
              </li>
            ))}
          </ul>
        )}
      </ApiView>
    </>
  );
}

function PolicyCard({ entry, programId, courseId, onChanged }: { readonly entry: Entry; readonly programId: string | null; readonly courseId: string | null; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { fmt } = useWorkspace();
  const resolution = entry.resolution;
  const levels = (entry.allowedScopes as readonly Level[]).filter((level) => level === "academy" || (level === "program" && programId) || (level === "course" && courseId));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          <code dir="ltr">{entry.key}</code>
        </h2>
        {resolution.status === "resolved" ? (
          <Badge tone="strong">{`${text.policies.source}: ${resolution.source}`}</Badge>
        ) : resolution.status === "invalid" ? (
          <Badge tone="warning">{text.policies.invalid}</Badge>
        ) : (
          <Badge tone="warning">{text.policies.unconfigured}</Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{fmt(text.policies.allowedAt, { levels: entry.allowedScopes.join(", ") })}</p>
      {resolution.status === "resolved" && (
        <div className="mt-2 text-sm">
          <p className="font-medium">{text.policies.effective}</p>
          <pre dir="ltr" className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(resolution.effectiveValue, null, 2)}</pre>
          {resolution.inheritedSource && (
            <p className="mt-1 text-muted-foreground">
              {text.policies.overrides}: {resolution.inheritedSource}
            </p>
          )}
        </div>
      )}
      {resolution.status === "invalid" && <Notice tone="warning">{resolution.message}</Notice>}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">{text.policies.edit}</summary>
        <PolicyEditor entry={entry} levels={levels} programId={programId} courseId={courseId} onChanged={onChanged} />
      </details>
    </Card>
  );
}

function PolicyEditor({ entry, levels, programId, courseId, onChanged }: { readonly entry: Entry; readonly levels: readonly Level[]; readonly programId: string | null; readonly courseId: string | null; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const id = useId();
  const [level, setLevel] = useState<Level>(levels[levels.length - 1] ?? "academy");
  const resolution = entry.resolution;
  const trail = resolution.status === "invalid" ? [] : resolution.trail;
  const atLevel = trail.find((row) => row.scope === level);
  const current = resolution.status === "resolved" && resolution.source === level ? JSON.stringify(resolution.effectiveValue, null, 2) : "";
  const [value, setValue] = useState(current);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const [jsonError, setJsonError] = useState(false);
  const action = useAction();
  const scopeId = level === "academy" ? null : level === "program" ? programId : courseId;

  async function set(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
      setJsonError(false);
    } catch {
      setJsonError(true);
      return;
    }
    const result = await action.run(adminApi.policy(entry.key), "PATCH", { action: "set", scope: level, scopeId, value: parsed, reason, expectedRevision: atLevel?.revision ?? null });
    if (result.ok) {
      setSaved(true);
      setReason("");
      onChanged();
    }
  }

  async function reset() {
    setSaved(false);
    const result = await action.run(adminApi.policy(entry.key), "PATCH", { action: "reset_to_inherited", scope: level, scopeId, reason, expectedRevision: atLevel?.revision });
    if (result.ok) {
      setSaved(true);
      onChanged();
    }
  }

  return (
    <form onSubmit={set} className="mt-3 space-y-3">
      <Field label={text.field.level} htmlFor={`${id}-level`}>
        <SelectInput
          id={`${id}-level`}
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as Level);
            setValue("");
          }}
        >
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={text.policies.value} htmlFor={`${id}-value`}>
        <TextArea id={`${id}-value`} dir="ltr" required rows={6} className="font-mono" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {jsonError && <Notice tone="warning">{t.states.invalid}</Notice>}
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
      {action.failure && <FailureNotice failure={action.failure} onRetry={onChanged} />}
      <Saved show={saved} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={action.busy}>
          {text.action.set}
        </Button>
        {level !== "academy" && atLevel?.defined && (
          <Button type="button" variant="outline" busy={action.busy} disabled={!reason.trim()} onClick={() => void reset()}>
            {text.action.reset}
          </Button>
        )}
      </div>
    </form>
  );
}
