"use client";

import { useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api, pages } from "@/components/academy/workspace/paths";
import type { MyCertificates } from "@/components/academy/workspace/types";
import { ApiView, Badge, DataTable, PageHeader, TextLink } from "@/components/academy/workspace/ui";

// The signed-in learner's own certificates.
export default function CertificatesPage() {
  const { t, date } = useWorkspace();
  const { state, reload } = useApi<MyCertificates>(api.myCertificates);
  return (
    <>
      <PageHeader title={t.certificates.title} />
      <ApiView state={state} onRetry={reload}>
        {(rows) => (
          <DataTable
            caption={t.certificates.title}
            rows={rows}
            rowKey={(row) => row.id}
            empty={t.certificates.empty}
            columns={[
              { key: "course", header: t.common.course, cell: (row) => row.courseTitle },
              { key: "issued", header: t.certificates.issued, cell: (row) => date(row.issuedAt) },
              { key: "state", header: t.common.status, cell: (row) => <Badge tone={row.state === "issued" ? "strong" : "warning"}>{t.certificates.state[row.state]}</Badge> },
              {
                key: "code",
                header: t.certificates.code,
                cell: (row) => (
                  <span className="flex flex-col gap-1">
                    <code dir="ltr" className="font-mono">{row.code}</code>
                    <TextLink href={pages.verifyCertificate(row.code)}>{t.certificates.verify}</TextLink>
                  </span>
                ),
              },
            ]}
          />
        )}
      </ApiView>
    </>
  );
}
