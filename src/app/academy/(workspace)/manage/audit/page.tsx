"use client";

import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { useAdminText } from "@/components/academy/workspace/admin/kit";
import type { AuditTrail } from "@/components/academy/workspace/admin/types";
import { requestJson, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Badge, Button, DataTable, Field, PageHeader, Section, SelectInput, TextInput } from "@/components/academy/workspace/ui";
import { ENTITY_KINDS } from "@/lib/academy/domain/ids";

interface Filters {
  objectKind: string;
  objectId: string;
  actorUid: string;
  action: string;
  correlationId: string;
}

const EMPTY: Filters = { objectKind: "", objectId: "", actorUid: "", action: "", correlationId: "" };

function query(filters: Filters, before?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim());
  if (before) params.set("before", before);
  params.set("limit", "50");
  return params.toString();
}

// The append-only audit trail with filters and keyset paging.
export default function AuditPage() {
  const text = useAdminText();
  const { t, dateTime } = useWorkspace();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const { state, reload } = useApi<AuditTrail>(adminApi.audit(query(filters)));
  const [more, setMore] = useState<AuditTrail>([]);
  const [exhausted, setExhausted] = useState(false);

  function apply(event: FormEvent) {
    event.preventDefault();
    setMore([]);
    setExhausted(false);
    setFilters(draft);
  }

  async function loadMore(rows: AuditTrail) {
    const last = rows[rows.length - 1];
    if (!last) return;
    const result = await requestJson<AuditTrail>(adminApi.audit(query(filters, last.occurredAt)));
    if (result.ok) {
      setMore((m) => [...m, ...result.data]);
      if (result.data.length < 50) setExhausted(true);
    }
  }

  const field = (key: keyof Filters, label: string) => (
    <Field label={label} htmlFor={`audit-${key}`} optional>
      <TextInput id={`audit-${key}`} dir="ltr" value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </Field>
  );

  return (
    <>
      <PageHeader title={text.audit.title} />
      <Section title={text.audit.filters}>
        <form onSubmit={apply} className="grid gap-3 rounded-md border p-3 md:grid-cols-3">
          <Field label={text.audit.objectKind} htmlFor="audit-objectKind" optional>
            <SelectInput id="audit-objectKind" value={draft.objectKind} onChange={(e) => setDraft((d) => ({ ...d, objectKind: e.target.value }))}>
              <option value="">{t.common.all}</option>
              {ENTITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </SelectInput>
          </Field>
          {field("objectId", text.audit.objectId)}
          {field("actorUid", text.audit.actorUid)}
          {field("action", text.audit.action)}
          {field("correlationId", text.audit.correlationId)}
          <div className="flex items-end">
            <Button type="submit">{text.action.apply}</Button>
          </div>
        </form>
      </Section>
      <ApiView state={state} onRetry={reload}>
        {(rows) => {
          const all = [...rows, ...more];
          return (
            <>
              <DataTable
                caption={text.audit.title}
                rows={all}
                rowKey={(row) => row.id}
                empty={text.audit.empty}
                columns={[
                  { key: "when", header: text.audit.occurredAt, cell: (row) => dateTime(row.occurredAt) },
                  { key: "action", header: text.audit.action, cell: (row) => <code dir="ltr">{row.action}</code> },
                  { key: "actor", header: text.audit.actor, cell: (row) => <code dir="ltr" className="break-all">{`${row.actorRole}:${row.actorUid}`}</code> },
                  { key: "object", header: text.audit.object, cell: (row) => <code dir="ltr" className="break-all">{`${row.objectKind}:${row.objectId}`}</code> },
                  { key: "impact", header: text.audit.impact, cell: (row) => <Badge tone={row.impact === "high" ? "warning" : "neutral"}>{row.impact}</Badge> },
                  { key: "reason", header: t.common.reason, cell: (row) => row.reason ?? "—" },
                ]}
              />
              {rows.length === 50 && !exhausted && (
                <div className="mt-3">
                  <Button type="button" variant="outline" onClick={() => void loadMore(all)}>
                    {text.action.loadMore}
                  </Button>
                </div>
              )}
            </>
          );
        }}
      </ApiView>
    </>
  );
}
