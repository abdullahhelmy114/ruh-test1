"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, ReasonCommand, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { ItemDetail } from "@/components/academy/workspace/admin/types";
import { VersionList } from "@/components/academy/workspace/admin/versions";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { pages } from "@/components/academy/workspace/paths";
import { ApiView, Badge, Button, DataTable, FailureNotice, Field, Notice, PageHeader, Section, SelectInput, TextInput, TextLink } from "@/components/academy/workspace/ui";

// A 2C content item: versions, course links and publication approval requests.
export default function ProductionItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const text = useAdminText();
  const { t, dateTime } = useWorkspace();
  const { state, reload } = useApi<ItemDetail>(adminApi.item(itemId));
  const gateAction = useAction();

  return (
    <ApiView state={state} onRetry={reload}>
      {({ item, versions, links, approvalGates }) => {
        const approved = versions.find((v) => v.state === "approved");
        async function requestApproval() {
          if (!approved) return;
          const result = await gateAction.run(adminApi.gates, "POST", { type: "publication", subjectKind: "content_item", subjectId: item.id, subjectVersionId: approved.id });
          if (result.ok) reload();
        }
        return (
          <>
            <PageHeader back={{ href: managePages.production, label: text.production.title }} title={item.title} intro={<Badge>{text.production.kind[item.kind]}</Badge>} />
            <Notice>{text.production.guard}</Notice>
            <div className="mt-6">
              <VersionList versions={versions} href={managePages.productionVersion} createUrl={adminApi.item(item.id)} onCreated={reload} />
            </div>
            <Section title={t.nav.approvals}>
              {approved && (
                <p className="mb-3">
                  <Button type="button" busy={gateAction.busy} onClick={() => void requestApproval()}>
                    {text.production.requestApproval}
                  </Button>
                </p>
              )}
              {gateAction.failure && <FailureNotice failure={gateAction.failure} onRetry={reload} />}
              <DataTable
                caption={t.nav.approvals}
                rows={approvalGates}
                rowKey={(gate) => gate.id}
                empty={t.approvals.empty}
                columns={[
                  { key: "type", header: text.field.type, cell: (gate) => <TextLink href={pages.approval(gate.id)}>{t.approvals.type[gate.type]}</TextLink> },
                  { key: "state", header: text.field.state, cell: (gate) => <Badge tone={gate.state === "approved" ? "strong" : "neutral"}>{t.approvals.gateState[gate.state]}</Badge> },
                  { key: "version", header: text.field.version, cell: (gate) => `v${versions.find((v) => v.id === gate.subjectVersionId)?.versionNumber ?? "?"}` },
                  { key: "requested", header: t.approvals.requested, cell: (gate) => dateTime(gate.requestedAt) },
                ]}
              />
            </Section>
            <Section title={text.production.links}>
              <AddLink itemId={item.id} onAdded={reload} />
              <div className="mt-3">
                <DataTable
                  caption={text.production.links}
                  rows={links.filter((link) => link.removedAt === null)}
                  rowKey={(link) => link.id}
                  empty={text.production.noLinks}
                  columns={[
                    { key: "target", header: text.field.targetKind, cell: (link) => `${text.production.linkTarget[link.targetKind]} · ${link.targetId.slice(0, 8)}` },
                    { key: "purpose", header: text.field.purpose, cell: (link) => text.production.linkPurpose[link.purpose] },
                    { key: "course", header: text.field.course, cell: (link) => <TextLink href={managePages.course(link.courseId)}>{link.courseId.slice(0, 8)}</TextLink> },
                    { key: "remove", header: <span className="sr-only">{text.action.removeReading}</span>, cell: (link) => <ReasonCommand label={text.action.removeReading} url={adminApi.link(link.id)} body={{ action: "remove", expectedRevision: link.revision }} onDone={reload} /> },
                  ]}
                />
              </div>
            </Section>
          </>
        );
      }}
    </ApiView>
  );
}

function AddLink({ itemId, onAdded }: { readonly itemId: string; readonly onAdded: () => void }) {
  const text = useAdminText();
  const [targetKind, setTargetKind] = useState<"course" | "lesson" | "assessment">("course");
  const [targetId, setTargetId] = useState("");
  const [purpose, setPurpose] = useState<"practice" | "enrichment" | "preparation" | "remediation">("practice");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(adminApi.itemLinks(itemId), "POST", { targetKind, targetId: targetId.trim(), purpose });
    if (result.ok) {
      setTargetId("");
      onAdded();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border p-3 md:grid-cols-[10rem_1fr_12rem_auto] md:items-end">
      <Field label={text.field.targetKind} htmlFor="link-kind">
        <SelectInput id="link-kind" value={targetKind} onChange={(e) => setTargetKind(e.target.value as typeof targetKind)}>
          <option value="course">{text.production.linkTarget.course}</option>
          <option value="lesson">{text.production.linkTarget.lesson}</option>
          <option value="assessment">{text.production.linkTarget.assessment}</option>
        </SelectInput>
      </Field>
      <Field label={text.field.targetId} htmlFor="link-target">
        <TextInput id="link-target" required dir="ltr" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
      </Field>
      <Field label={text.field.purpose} htmlFor="link-purpose">
        <SelectInput id="link-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as typeof purpose)}>
          <option value="practice">{text.production.linkPurpose.practice}</option>
          <option value="enrichment">{text.production.linkPurpose.enrichment}</option>
          <option value="preparation">{text.production.linkPurpose.preparation}</option>
          <option value="remediation">{text.production.linkPurpose.remediation}</option>
        </SelectInput>
      </Field>
      <Button type="submit" busy={action.busy}>
        {text.production.addLink}
      </Button>
      {action.failure && (
        <div className="md:col-span-4">
          <FailureNotice failure={action.failure} />
        </div>
      )}
    </form>
  );
}
