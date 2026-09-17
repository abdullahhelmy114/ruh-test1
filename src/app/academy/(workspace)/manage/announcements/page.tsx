"use client";

import { useState, type FormEvent } from "react";
import { AnnouncementFeed } from "@/components/academy/workspace/announcements";
import { adminApi } from "@/components/academy/workspace/admin/api-paths";
import { Saved, useAdminText } from "@/components/academy/workspace/admin/kit";
import type { Courses } from "@/components/academy/workspace/admin/types";
import { useAction, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { api } from "@/components/academy/workspace/paths";
import { Button, FailureNotice, Field, PageHeader, Section, SelectInput, TextArea, TextInput } from "@/components/academy/workspace/ui";

// Academy-wide and course-wide announcements (class group announcements are
// posted by the class group's teachers from the class workspace).
export default function ManageAnnouncementsPage() {
  const text = useAdminText();
  const { t } = useWorkspace();
  const courses = useApi<Courses>(adminApi.courses());
  const [scope, setScope] = useState<"academy" | "course">("academy");
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [nonce, setNonce] = useState(0);
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const result = await action.run(adminApi.announcements, "POST", { scope, courseId: scope === "course" ? courseId : undefined, title, body });
    if (result.ok) {
      setTitle("");
      setBody("");
      setSaved(true);
      setNonce((n) => n + 1);
    }
  }

  return (
    <>
      <PageHeader title={text.announcements.title} />
      <Section title={text.announcements.publish}>
        <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={text.field.scope} htmlFor="announce-scope">
              <SelectInput id="announce-scope" value={scope} onChange={(e) => setScope(e.target.value as "academy" | "course")}>
                <option value="academy">{text.announcements.scope.academy}</option>
                <option value="course">{text.announcements.scope.course}</option>
              </SelectInput>
            </Field>
            {scope === "course" && (
              <Field label={text.field.course} htmlFor="announce-course">
                <SelectInput id="announce-course" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">{t.common.choose}</option>
                  {(courses.state.status === "ready" ? courses.state.data.filter((c) => c.deletedAt === null) : []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}
          </div>
          <Field label={t.classGroup.announcementTitle} htmlFor="announce-title">
            <TextInput id="announce-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t.classGroup.announcementBody} htmlFor="announce-body">
            <TextArea id="announce-body" required maxLength={20000} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {action.failure && <FailureNotice failure={action.failure} />}
          <Saved show={saved} />
          <Button type="submit" busy={action.busy}>
            {text.action.publish}
          </Button>
        </form>
      </Section>
      <Section title={text.announcements.scope.academy}>
        <AnnouncementFeed key={nonce} url={api.announcements} />
      </Section>
    </>
  );
}
