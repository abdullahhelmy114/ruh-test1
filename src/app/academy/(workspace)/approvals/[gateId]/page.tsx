"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { GateDetail } from "@/components/academy/workspace/types";
import { ApiView, Badge, Button, Card, DataTable, FailureNotice, Field, KeyValues, Notice, PageHeader, Section, SelectInput, TextArea } from "@/components/academy/workspace/ui";

// One approval request: its snapshot, the decisions so far, and a decision
// form. Eligibility, self-approval and one-decision-per-person are enforced
// by the server against the gate's own snapshot.
export default function ApprovalPage() {
  const { gateId } = useParams<{ gateId: string }>();
  const { t, fmt, dateTime } = useWorkspace();
  const { state, reload } = useApi<GateDetail>(api.gate(gateId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ gate, decisions }) => (
        <>
          <PageHeader back={{ href: pages.approvals, label: t.approvals.title }} title={t.approvals.type[gate.type]} />
          <Card className="mb-6">
            <KeyValues
              items={[
                { label: t.common.status, value: <Badge tone={gate.state === "open" ? "warning" : "strong"}>{t.approvals.gateState[gate.state]}</Badge> },
                {
                  label: t.approvals.subject,
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {t.approvals.kind[gate.subject.kind as keyof typeof t.approvals.kind] ?? gate.subject.kind}
                      <bdi dir="ltr"><code className="font-mono text-xs text-muted-foreground">{gate.subject.id}</code></bdi>
                    </span>
                  ),
                },
                ...(gate.subjectVersionId ? [{ label: t.common.details, value: <code dir="ltr">{gate.subjectVersionId}</code> }] : []),
                { label: t.approvals.requested, value: dateTime(gate.requestedAt) },
                { label: t.common.status, value: fmt(t.approvals.needed, { count: gate.requiredApprovals }) },
              ]}
            />
          </Card>
          <Section title={t.approvals.history}>
            <DataTable
              caption={t.approvals.history}
              rows={decisions}
              rowKey={(d) => d.id}
              empty={t.approvals.noDecisions}
              columns={[
                { key: "decision", header: t.approvals.decide, cell: (d) => <Badge>{t.approvals.decision[d.decision]}</Badge> },
                { key: "role", header: t.common.details, cell: (d) => t.approvals.role[d.decidedRole as keyof typeof t.approvals.role] ?? d.decidedRole },
                { key: "reason", header: t.common.reason, cell: (d) => d.reason ?? "—" },
                { key: "when", header: t.approvals.requested, cell: (d) => dateTime(d.decidedAt) },
              ]}
            />
          </Section>
          {gate.state === "open" ? <DecisionForm gateId={gate.id} onDecided={reload} /> : <Notice>{t.approvals.gateState[gate.state]}</Notice>}
        </>
      )}
    </ApiView>
  );
}

function DecisionForm({ gateId, onDecided }: { readonly gateId: string; readonly onDecided: () => void }) {
  const { t } = useWorkspace();
  const [decision, setDecision] = useState<"approve" | "reject" | "request_changes">("approve");
  const [reason, setReason] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(api.gate(gateId), "POST", { decision, reason: reason || undefined });
    if (result.ok) onDecided();
  }

  return (
    <Section title={t.approvals.decide}>
      <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
        <Field label={t.approvals.decide} htmlFor="gate-decision">
          <SelectInput id="gate-decision" value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            {(["approve", "reject", "request_changes"] as const).map((value) => (
              <option key={value} value={value}>
                {t.approvals.decision[value]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label={t.approvals.decisionReason} htmlFor="gate-reason">
          <TextArea id="gate-reason" value={reason} required={decision !== "approve"} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {action.failure && <FailureNotice failure={action.failure} onRetry={onDecided} />}
        <Button type="submit" busy={action.busy}>
          {t.approvals.record}
        </Button>
      </form>
    </Section>
  );
}
