"use client";

import { useParams } from "next/navigation";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, ReasonCommand, StateChange, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Program } from "@/components/academy/workspace/admin/types";
import { EditTitle } from "@/components/academy/workspace/admin/common";
import { useApi } from "@/components/academy/workspace/api";
import { ApiView, Badge, Card, KeyValues, PageHeader, Section } from "@/components/academy/workspace/ui";

const CATALOG_NEXT: Readonly<Record<string, readonly string[]>> = { draft: ["active"], active: ["retired"], retired: ["active"] };

export default function ProgramPage() {
  const { programId } = useParams<{ programId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<Program>(adminApi.program(programId));
  return (
    <ApiView state={state} onRetry={reload}>
      {(program) => (
        <>
          <PageHeader back={{ href: managePages.catalog, label: text.catalog.title }} title={program.title} />
          <Card className="mb-6">
            <KeyValues
              items={[
                { label: text.field.slug, value: <code dir="ltr">{program.slug}</code> },
                { label: text.field.state, value: <Badge>{text.state.catalog[program.status]}</Badge> },
                ...(program.deletedAt ? [{ label: text.action.deleted, value: program.deletionReason ?? "" }] : []),
              ]}
            />
          </Card>
          <Section title={text.action.save}>
            <EditTitle key={program.revision} url={adminApi.program(program.id)} title={program.title} description={program.description} revision={program.revision} onSaved={reload} />
          </Section>
          <Section title={text.action.changeStatus}>
            <StateChange url={adminApi.program(program.id)} states={CATALOG_NEXT[program.status] ?? []} labels={text.state.catalog} revision={program.revision} onChanged={reload} />
          </Section>
          <Section title={program.deletedAt ? text.action.restore : text.action.delete}>
            {program.deletedAt ? (
              <ReasonCommand label={text.action.restore} url={adminApi.program(program.id)} body={{ action: "restore", expectedRevision: program.revision }} onDone={reload} variant="primary" />
            ) : (
              <ReasonCommand label={text.action.delete} url={adminApi.program(program.id)} body={{ action: "delete", expectedRevision: program.revision }} onDone={reload} />
            )}
          </Section>
        </>
      )}
    </ApiView>
  );
}
