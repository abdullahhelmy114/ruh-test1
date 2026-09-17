"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { managePages, Saved, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { ItemDetail, ItemVersion } from "@/components/academy/workspace/admin/types";
import { MUTABLE_STATES, VersionHeader } from "@/components/academy/workspace/admin/versions";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { ApiView, Button, FailureNotice, Field, Notice, PageHeader, Section, SelectInput, TextArea, TextInput } from "@/components/academy/workspace/ui";
import { ORIGINS, RIGHTS_STATUSES, type Provenance } from "@/lib/academy/production/content";
import { CONTENT_TEMPLATES } from "@/lib/academy/workspace/content-templates";

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

// A 2C content version: structured content and provenance while it is a
// draft, then human review, a publication approval request and publication.
export default function ProductionVersionPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const text = useAdminText();
  const { state, reload } = useApi<ItemVersion>(adminApi.productionVersion(versionId));
  return (
    <ApiView state={state} onRetry={reload}>
      {({ version, content, provenance }) => (
        <>
          <PageHeader back={{ href: managePages.productionItem(version.parentId), label: text.production.items }} title={`${text.production.content.replace(" (JSON)", "")} v${version.versionNumber}`} />
          <Notice>{text.production.guard}</Notice>
          <div className="mt-6">
            <VersionHeader version={version} url={adminApi.productionVersion(version.id)} onChanged={reload} />
          </div>
          <VersionEditor key={version.revision} itemId={version.parentId} versionId={version.id} revision={version.revision} editable={MUTABLE_STATES.includes(version.state)} content={content} provenance={provenance} onSaved={reload} />
        </>
      )}
    </ApiView>
  );
}

function VersionEditor({
  itemId,
  versionId,
  revision,
  editable,
  content,
  provenance,
  onSaved,
}: {
  readonly itemId: string;
  readonly versionId: string;
  readonly revision: number;
  readonly editable: boolean;
  readonly content: unknown;
  readonly provenance: Provenance | null;
  readonly onSaved: () => void;
}) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [json, setJson] = useState(content === null || content === undefined ? "" : JSON.stringify(content, null, 2));
  const [origin, setOrigin] = useState<string>(provenance?.origin ?? "original");
  const [rights, setRights] = useState<string>(provenance?.rightsStatus ?? "pending");
  const [sources, setSources] = useState((provenance?.sources ?? []).map((s) => [s.title, s.reference ?? "", s.license ?? ""].join(" | ")).join("\n"));
  const [contributors, setContributors] = useState((provenance?.contributors ?? []).map((c) => `${c.name} | ${c.role}`).join("\n"));
  const [tool, setTool] = useState(provenance?.assistedToolLabel ?? "");
  const [notes, setNotes] = useState(provenance?.notes ?? "");
  const [jsonError, setJsonError] = useState(false);
  const [saved, setSaved] = useState(false);
  const action = useAction();
  const item = useApi<ItemDetail>(adminApi.item(itemId));
  const kind = item.state.status === "ready" ? item.state.data.item.kind : null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    let parsedContent: unknown = undefined;
    if (json.trim() !== "") {
      try {
        parsedContent = JSON.parse(json);
        setJsonError(false);
      } catch {
        setJsonError(true);
        return;
      }
    }
    const nextProvenance = {
      origin,
      rightsStatus: rights,
      sources: lines(sources).map((line) => {
        const [title = "", reference = "", license = ""] = line.split("|").map((c) => c.trim());
        return { title, reference: reference || null, license: license || null };
      }),
      contributors: lines(contributors).map((line) => {
        const [name = "", role = ""] = line.split("|").map((c) => c.trim());
        return { name, role };
      }),
      assistedToolLabel: tool.trim() || null,
      notes: notes.trim() || null,
    };
    const result = await action.run(adminApi.productionVersion(versionId), "PATCH", { action: "save", content: parsedContent, provenance: nextProvenance, expectedRevision: revision });
    if (result.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset disabled={!editable || action.busy} className="space-y-6">
        <Section title={text.production.content}>
          <Field label={text.production.content} htmlFor="content-json" hint={text.production.contentHint}>
            <TextArea id="content-json" dir="ltr" rows={16} className="font-mono text-xs" aria-describedby="content-json-hint" value={json} onChange={(e) => setJson(e.target.value)} />
          </Field>
          {jsonError && <Notice tone="warning">{t.states.invalid}</Notice>}
          {editable && kind && json.trim() === "" && (
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setJson(JSON.stringify(CONTENT_TEMPLATES[kind], null, 2))}>
              {text.production.template}
            </Button>
          )}
        </Section>
        <Section title={text.production.provenance}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={text.production.provenance} htmlFor="provenance-origin">
              <SelectInput id="provenance-origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {ORIGINS.map((o) => (
                  <option key={o} value={o}>
                    {text.production.origin[o]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={text.field.state} htmlFor="provenance-rights">
              <SelectInput id="provenance-rights" value={rights} onChange={(e) => setRights(e.target.value)}>
                {RIGHTS_STATUSES.map((r) => (
                  <option key={r} value={r}>
                    {text.production.rights[r]}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 space-y-3">
            <Field label={text.production.sources} htmlFor="provenance-sources" optional>
              <TextArea id="provenance-sources" dir="auto" rows={3} value={sources} onChange={(e) => setSources(e.target.value)} />
            </Field>
            <Field label={text.production.contributors} htmlFor="provenance-contributors">
              <TextArea id="provenance-contributors" dir="auto" rows={3} value={contributors} onChange={(e) => setContributors(e.target.value)} />
            </Field>
            <Field label={text.production.assistedTool} htmlFor="provenance-tool" optional>
              <TextInput id="provenance-tool" value={tool} onChange={(e) => setTool(e.target.value)} />
            </Field>
            <Field label={text.production.notes} htmlFor="provenance-notes" optional>
              <TextArea id="provenance-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </Section>
      </fieldset>
      {!editable && <Notice>{text.script.readOnly}</Notice>}
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      <Saved show={saved} />
      {editable && (
        <Button type="submit" busy={action.busy}>
          {text.action.save}
        </Button>
      )}
    </form>
  );
}
