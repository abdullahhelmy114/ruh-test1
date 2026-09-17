"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { ReasonCommand, Saved, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { GateDefinitions } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { OpenGates } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, DataTable, FailureNotice, Field, PageHeader, ReasonField, Section, SelectInput, TextInput, TextLink } from "@/components/academy/workspace/ui";
import { ENTITY_KINDS } from "@/lib/academy/domain/ids";
import { GATE_TYPES } from "@/lib/academy/governance/approval-gates";

// Approval gates: explicit configuration (no defaults), opening requests, and
// the open list. Decisions are recorded on the request page by eligible people.
export default function ApprovalGatesPage() {
  const text = useAdminText();
  const { t, fmt, dateTime } = useWorkspace();
  const definitions = useApi<GateDefinitions>(adminApi.gateDefinitions);
  const open = useApi<OpenGates>(api.gates);

  return (
    <>
      <PageHeader title={text.gates.title} />
      <Section title={text.gates.definitions}>
        <ApiView state={definitions.state} onRetry={definitions.reload}>
          {(rows) => (
            <DataTable
              caption={text.gates.definitions}
              rows={rows}
              rowKey={(row) => row.type}
              empty={text.gates.noDefinitions}
              columns={[
                { key: "type", header: text.field.type, cell: (row) => t.approvals.type[row.type] },
                { key: "required", header: text.field.requiredApprovals, cell: (row) => row.requiredApprovals },
                { key: "roles", header: text.field.eligibleRoles, cell: (row) => row.eligibleRoles.join(", ") },
                { key: "self", header: text.field.allowSelfApproval, cell: (row) => (row.allowSelfApproval ? t.common.yes : t.common.no) },
              ]}
            />
          )}
        </ApiView>
        <ConfigureGate onSaved={definitions.reload} />
      </Section>
      <Section title={text.gates.open}>
        <OpenGate onOpened={open.reload} />
      </Section>
      <Section title={text.gates.openRequests}>
        <ApiView state={open.state} onRetry={open.reload}>
          {(rows) => (
            <DataTable
              caption={text.gates.openRequests}
              rows={rows}
              rowKey={(row) => row.id}
              empty={text.gates.noOpen}
              columns={[
                { key: "type", header: text.field.type, cell: (row) => <TextLink href={pages.approval(row.id)}>{t.approvals.type[row.type]}</TextLink> },
                { key: "subject", header: text.field.subjectKind, cell: (row) => <code dir="ltr">{`${row.subject.kind}:${row.subject.id.slice(0, 8)}`}</code> },
                { key: "requested", header: t.approvals.requested, cell: (row) => dateTime(row.requestedAt) },
                { key: "needed", header: text.field.requiredApprovals, cell: (row) => <Badge>{fmt(t.approvals.needed, { count: row.requiredApprovals })}</Badge> },
                { key: "cancel", header: <span className="sr-only">{text.action.cancelGate}</span>, cell: (row) => <ReasonCommand label={text.action.cancelGate} url={adminApi.gate(row.id)} body={{ action: "cancel" }} onDone={open.reload} /> },
              ]}
            />
          )}
        </ApiView>
      </Section>
    </>
  );
}

function ConfigureGate({ onSaved }: { readonly onSaved: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [type, setType] = useState<string>(GATE_TYPES[0]);
  const [required, setRequired] = useState("1");
  const [admin, setAdmin] = useState(true);
  const [teacher, setTeacher] = useState(false);
  const [self, setSelf] = useState(false);
  const [reason, setReason] = useState("");
  const [saved, setSaved] = useState(false);
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const eligibleRoles = [...(admin ? ["admin"] : []), ...(teacher ? ["teacher"] : [])];
    const result = await action.run(adminApi.gateDefinitions, "PUT", { type, requiredApprovals: Number(required), eligibleRoles, allowSelfApproval: self, reason });
    if (result.ok) {
      setSaved(true);
      setReason("");
      onSaved();
    }
  }

  return (
    <details className="mt-4 rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{text.gates.configure}</summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={text.field.type} htmlFor="gate-type">
            <SelectInput id="gate-type" value={type} onChange={(e) => setType(e.target.value)}>
              {GATE_TYPES.map((g) => (
                <option key={g} value={g}>
                  {t.approvals.type[g]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={text.field.requiredApprovals} htmlFor="gate-required">
            <TextInput id="gate-required" type="number" min={1} max={10} required value={required} onChange={(e) => setRequired(e.target.value)} />
          </Field>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">{text.field.eligibleRoles}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
            {text.field.roleAdmin}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={teacher} onChange={(e) => setTeacher(e.target.checked)} />
            {text.field.roleTeacher}
          </label>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} />
          {text.field.allowSelfApproval}
        </label>
        <ReasonField id="gate-reason" value={reason} onChange={setReason} />
        {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
        <Saved show={saved} />
        <Button type="submit" busy={action.busy}>
          {text.action.configure}
        </Button>
      </form>
    </details>
  );
}

function OpenGate({ onOpened }: { readonly onOpened: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [type, setType] = useState<string>(GATE_TYPES[0]);
  const [subjectKind, setSubjectKind] = useState<string>("content_item");
  const [subjectId, setSubjectId] = useState("");
  const [subjectVersionId, setSubjectVersionId] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.gates, "POST", { type, subjectKind, subjectId: subjectId.trim(), subjectVersionId: subjectVersionId.trim() || undefined });
    if (result.ok) {
      setSubjectId("");
      setSubjectVersionId("");
      onOpened();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
      <Field label={text.field.type} htmlFor="open-gate-type">
        <SelectInput id="open-gate-type" value={type} onChange={(e) => setType(e.target.value)}>
          {GATE_TYPES.map((g) => (
            <option key={g} value={g}>
              {t.approvals.type[g]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={text.field.subjectKind} htmlFor="open-gate-kind">
        <SelectInput id="open-gate-kind" value={subjectKind} onChange={(e) => setSubjectKind(e.target.value)}>
          {ENTITY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label={text.field.subjectId} htmlFor="open-gate-subject">
        <TextInput id="open-gate-subject" required dir="ltr" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
      </Field>
      <Field label={text.field.subjectVersionId} htmlFor="open-gate-version" optional>
        <TextInput id="open-gate-version" dir="ltr" value={subjectVersionId} onChange={(e) => setSubjectVersionId(e.target.value)} />
      </Field>
      {action.failure && (
        <div className="md:col-span-2">
          <FailureNotice failure={action.failure} />
        </div>
      )}
      <div>
        <Button type="submit" busy={action.busy}>
          {text.action.openGate}
        </Button>
      </div>
    </form>
  );
}
