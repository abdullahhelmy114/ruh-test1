"use client";

import { useAction } from "../api";
import { useWorkspace } from "../context";
import { Badge, Button, Card, DataTable, FailureNotice, KeyValues, Section, TextLink } from "../ui";
import { ReviewBar, useAdminText } from "./kit";

export interface VersionSummary {
  readonly id: string;
  readonly versionNumber: number;
  readonly state: string;
  readonly createdBy: string;
  readonly updatedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedBy: string | null;
  readonly publishedAt: string | null;
}

/** Version history with a "start a new draft" command (the server refuses a second working version). */
export function VersionList({
  versions,
  href,
  createUrl,
  onCreated,
}: {
  readonly versions: readonly VersionSummary[];
  readonly href: (id: string) => string;
  readonly createUrl: string;
  readonly onCreated: () => void;
}) {
  const text = useAdminText();
  const { dateTime } = useWorkspace();
  const action = useAction();

  async function create() {
    const result = await action.run(createUrl, "POST", { action: "create_draft" });
    if (result.ok) onCreated();
  }

  return (
    <Section
      title={text.course.versions}
      actions={
        <Button type="button" size="sm" busy={action.busy} onClick={() => void create()}>
          {text.action.newDraft}
        </Button>
      }
    >
      {action.failure && <FailureNotice failure={action.failure} onRetry={onCreated} />}
      <DataTable
        caption={text.course.versions}
        rows={[...versions].sort((a, b) => b.versionNumber - a.versionNumber)}
        rowKey={(row) => row.id}
        empty={text.course.noVersions}
        columns={[
          { key: "number", header: text.field.version, cell: (row) => <TextLink href={href(row.id)}>{`v${row.versionNumber}`}</TextLink> },
          { key: "state", header: text.field.state, cell: (row) => <Badge tone={row.state === "published" ? "strong" : "neutral"}>{text.state.version[row.state as keyof typeof text.state.version] ?? row.state}</Badge> },
          { key: "updated", header: text.field.updated, cell: (row) => dateTime(row.updatedAt) },
        ]}
      />
    </Section>
  );
}

/** A governed version's facts and its review commands. */
export function VersionHeader({ version, url, onChanged }: { readonly version: VersionSummary & { readonly revision: number }; readonly url: string; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { dateTime } = useWorkspace();
  return (
    <div className="mb-6 space-y-3">
      <Card>
        <KeyValues
          items={[
            { label: text.field.version, value: `v${version.versionNumber}` },
            { label: text.field.state, value: <Badge tone={version.state === "published" ? "strong" : "neutral"}>{text.state.version[version.state as keyof typeof text.state.version] ?? version.state}</Badge> },
            { label: text.field.updated, value: dateTime(version.updatedAt) },
            ...(version.publishedAt ? [{ label: text.state.version.published, value: dateTime(version.publishedAt) }] : []),
          ]}
        />
      </Card>
      <ReviewBar state={version.state} revision={version.revision} url={url} onChanged={onChanged} />
    </div>
  );
}

export const MUTABLE_STATES: readonly string[] = ["draft", "changes_requested"];
