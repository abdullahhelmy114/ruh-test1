"use client";

import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { OpenGates } from "@/components/academy/workspace/types";
import { ApiView, DataTable, PageHeader, TextLink } from "@/components/academy/workspace/ui";

// Open approval requests the caller is eligible to decide (the server filters).
export default function ApprovalsPage() {
  const { t, fmt, dateTime } = useWorkspace();
  const { state, reload } = useApi<OpenGates>(api.gates);
  return (
    <>
      <PageHeader title={t.approvals.title} intro={t.approvals.intro} />
      <ApiView state={state} onRetry={reload}>
        {(gates) => (
          <DataTable
            caption={t.approvals.title}
            rows={gates}
            rowKey={(gate) => gate.id}
            empty={t.approvals.empty}
            columns={[
              { key: "type", header: t.common.title, cell: (gate) => <TextLink href={pages.approval(gate.id)}>{t.approvals.type[gate.type]}</TextLink> },
              { key: "subject", header: t.approvals.subject, cell: (gate) => `${gate.subject.kind}` },
              { key: "requested", header: t.approvals.requested, cell: (gate) => dateTime(gate.requestedAt) },
              { key: "needed", header: t.common.status, cell: (gate) => fmt(t.approvals.needed, { count: gate.requiredApprovals }) },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}
