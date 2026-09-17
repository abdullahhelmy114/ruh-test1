"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "../api";
import { Badge, Button, FailureNotice, Field, TextArea, TextInput } from "../ui";
import { useAdminText } from "./kit";

export function StateBadge({ state, deleted }: { readonly state: string; readonly deleted: boolean }) {
  const text = useAdminText();
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={state === "active" ? "strong" : "neutral"}>{text.state.catalog[state as keyof typeof text.state.catalog] ?? state}</Badge>
      {deleted && <Badge tone="warning">{text.action.deleted}</Badge>}
    </span>
  );
}


/** Title and description editing for a program or course. */
export function EditTitle({ url, title, description, revision, onSaved }: { readonly url: string; readonly title: string; readonly description: string | null; readonly revision: number; readonly onSaved: () => void }) {
  const text = useAdminText();
  const [nextTitle, setNextTitle] = useState(title);
  const [nextDescription, setNextDescription] = useState(description ?? "");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(url, "PATCH", { action: "update", title: nextTitle, description: nextDescription, expectedRevision: revision });
    if (result.ok) onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-4">
      <Field label={text.field.title} htmlFor="edit-title">
        <TextInput id="edit-title" required maxLength={200} value={nextTitle} onChange={(e) => setNextTitle(e.target.value)} />
      </Field>
      <Field label={text.field.description} htmlFor="edit-description" optional>
        <TextArea id="edit-description" maxLength={5000} value={nextDescription} onChange={(e) => setNextDescription(e.target.value)} />
      </Field>
      {action.failure && <FailureNotice failure={action.failure} onRetry={onSaved} />}
      <Button type="submit" busy={action.busy}>
        {text.action.save}
      </Button>
    </form>
  );
}
