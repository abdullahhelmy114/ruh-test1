"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from "react";
import type { AdminText } from "@/lib/academy/workspace/admin-messages";
import { commandsFor, REASON_REQUIRED, type ReviewCommand } from "@/lib/academy/workspace/review-commands";
import { displayName } from "@/lib/academy/workspace/format";
import { isoToWallClockInput, wallClockInputToIso } from "@/lib/academy/workspace/wall-clock-input";
import { cn } from "@/lib/utils";
import { useAction, useApi } from "../api";
import { adminApi } from "./api-paths";
import { useWorkspace } from "../context";
import { Button, FailureNotice, Field, Notice, ReasonField, SelectInput } from "../ui";

const AdminTextContext = createContext<AdminText | null>(null);

export function AdminTextProvider({ text, children }: { readonly text: AdminText; readonly children: ReactNode }) {
  return <AdminTextContext.Provider value={text}>{children}</AdminTextContext.Provider>;
}

export function useAdminText(): AdminText {
  const text = useContext(AdminTextContext);
  if (!text) throw new Error("useAdminText must be used inside AdminTextProvider.");
  return text;
}

export const managePages = {
  overview: "/academy/manage",
  catalog: "/academy/manage/catalog",
  program: (id: string) => `/academy/manage/programs/${encodeURIComponent(id)}`,
  course: (id: string, tab?: string) => `/academy/manage/courses/${encodeURIComponent(id)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
  curriculumVersion: (id: string) => `/academy/manage/curriculum-versions/${encodeURIComponent(id)}`,
  lessonScript: (lessonId: string) => `/academy/manage/lessons/${encodeURIComponent(lessonId)}`,
  lessonScriptVersion: (id: string) => `/academy/manage/lesson-script-versions/${encodeURIComponent(id)}`,
  assessment: (id: string) => `/academy/manage/assessments/${encodeURIComponent(id)}`,
  assessmentVersion: (id: string) => `/academy/manage/assessment-versions/${encodeURIComponent(id)}`,
  classGroups: "/academy/manage/class-groups",
  classGroup: (id: string, tab?: string) => `/academy/manage/class-groups/${encodeURIComponent(id)}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`,
  policies: "/academy/manage/policies",
  gates: "/academy/manage/approval-gates",
  reviewQueue: "/academy/manage/review-queue",
  audit: "/academy/manage/audit",
  announcements: "/academy/manage/announcements",
  production: "/academy/manage/production",
  productionItem: (id: string) => `/academy/manage/production/items/${encodeURIComponent(id)}`,
  productionVersion: (id: string) => `/academy/manage/production/versions/${encodeURIComponent(id)}`,
  teachers: "/academy/manage/teachers",
  teacherApplication: (id: string) => `/academy/manage/teachers/applications/${encodeURIComponent(id)}`,
};

/** Administration section navigation. Every page and API enforces administrator access on the server. */
export function ManageNav() {
  const text = useAdminText();
  const pathname = usePathname() ?? "";
  const items = [
    { href: managePages.overview, label: text.nav.overview, exact: true },
    { href: managePages.catalog, label: text.nav.catalog },
    { href: managePages.classGroups, label: text.nav.classGroups },
    { href: managePages.teachers, label: text.nav.teachers },
    { href: managePages.policies, label: text.nav.policies },
    { href: managePages.gates, label: text.nav.gates },
    { href: managePages.reviewQueue, label: text.nav.reviewQueue },
    { href: managePages.audit, label: text.nav.audit },
    { href: managePages.announcements, label: text.nav.announcements },
    { href: managePages.production, label: text.nav.production },
  ];
  return (
    <nav aria-label={text.nav.label} className="mb-6">
      <ul className="flex flex-wrap gap-1 rounded-md border p-1">
        {items.map((item) => {
          const current = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-block rounded px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  current ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Review and publication commands for a curriculum, Lesson Script, assessment
 * or 2C content version. Reviewer-is-author rules, gates and immutability are
 * enforced by the server; failures are shown as sent.
 */
export function ReviewBar({ state, revision, url, onChanged }: { readonly state: string; readonly revision: number; readonly url: string; readonly onChanged: () => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const [chosen, setChosen] = useState<ReviewCommand | null>(null);
  const [reason, setReason] = useState("");
  const action = useAction();
  const id = useId();
  const commands = commandsFor(state);
  if (commands.length === 0) return null;

  async function run(command: ReviewCommand, withReason: string) {
    const result = await action.run(url, "PATCH", { action: command, reason: withReason || undefined, expectedRevision: revision });
    if (result.ok) {
      setChosen(null);
      setReason("");
      onChanged();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (chosen) void run(chosen, reason);
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap gap-2">
        {commands.map((command) => (
          <Button
            key={command}
            type="button"
            size="sm"
            variant={command === "publish" || command === "approve" || command === "submit" ? "primary" : command === "reject" || command === "archive" ? "danger" : "outline"}
            busy={action.busy && chosen === command}
            onClick={() => {
              if (REASON_REQUIRED.includes(command) || command === "approve") setChosen(command);
              else void run(command, "");
            }}
          >
            {text.action.review[command]}
          </Button>
        ))}
      </div>
      {chosen && (
        <form onSubmit={submit} className="space-y-2">
          <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} required={REASON_REQUIRED.includes(chosen)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" busy={action.busy}>
              {text.action.review[chosen]}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setChosen(null)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
      {action.failure && <FailureNotice failure={action.failure} onRetry={onChanged} />}
    </div>
  );
}

/** Moves an entity to another state with a reason, via a command-style PATCH. */
export function StateChange({
  url,
  states,
  labels,
  revision,
  onChanged,
  command = "change_status",
  reasonOptional = [],
}: {
  readonly url: string;
  readonly states: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly revision: number;
  readonly onChanged: () => void;
  readonly command?: string;
  /** Target states whose reason may be left out. */
  readonly reasonOptional?: readonly string[];
}) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const id = useId();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const action = useAction();
  if (states.length === 0) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(url, "PATCH", { action: command, to, reason: reason || undefined, expectedRevision: revision });
    if (result.ok) {
      setTo("");
      setReason("");
      onChanged();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-md border p-3">
      <Field label={text.action.changeStatus} htmlFor={`${id}-to`}>
        <SelectInput id={`${id}-to`} required value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{t.common.choose}</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {labels[state] ?? state}
            </option>
          ))}
        </SelectInput>
      </Field>
      {to && <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} required={!reasonOptional.includes(to)} />}
      {action.failure && <FailureNotice failure={action.failure} onRetry={onChanged} />}
      <Button type="submit" size="sm" busy={action.busy} disabled={!to}>
        {text.action.changeStatus}
      </Button>
    </form>
  );
}

/** A command that needs a reason (delete, restore, revoke, cancel, remove, retire). */
export function ReasonCommand({
  label,
  url,
  method = "PATCH",
  body,
  onDone,
  variant = "danger",
  reasonKey = "reason",
}: {
  readonly label: string;
  readonly url: string;
  readonly method?: "PATCH" | "POST";
  readonly body: Readonly<Record<string, unknown>>;
  readonly onDone: () => void;
  readonly variant?: "danger" | "outline" | "primary";
  readonly reasonKey?: string;
}) {
  const { t } = useWorkspace();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(url, method, { ...body, [reasonKey]: reason });
    if (result.ok) {
      setOpen(false);
      setReason("");
      onDone();
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="w-full space-y-2 rounded-md border p-3">
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
      {action.failure && <FailureNotice failure={action.failure} onRetry={onDone} />}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant={variant} busy={action.busy}>
          {label}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

interface Person {
  readonly firebase_uid: string;
  readonly full_name: string | null;
  readonly email: string | null;
  readonly role: string;
}

const selectUsers = (body: unknown): Person[] => {
  const users = body && typeof body === "object" ? (body as { users?: unknown }).users : undefined;
  return Array.isArray(users) ? (users as Person[]) : [];
};

const selectActiveTeachers = (body: unknown): Person[] => {
  const data = body && typeof body === "object" ? (body as { data?: unknown }).data : undefined;
  return Array.isArray(data)
    ? (data as { uid: string; name: string | null; email: string | null; status: string | null }[])
        .filter((teacher) => teacher.status === "active")
        .map((teacher) => ({ firebase_uid: teacher.uid, full_name: teacher.name, email: teacher.email, role: "teacher" }))
    : [];
};

/**
 * Chooses an account of a role from the administrator-only directories.
 * Teachers come from the teacher directory filtered to active accounts, so
 * applicants and deactivated teachers are never offered (the server refuses
 * them anyway).
 */
export function PersonSelect({ id, role, value, onChange }: { readonly id: string; readonly role: "teacher" | "student"; readonly value: string; readonly onChange: (uid: string) => void }) {
  const text = useAdminText();
  const { t } = useWorkspace();
  const { state } = useApi<Person[]>(role === "teacher" ? adminApi.teachers(true) : adminApi.people, role === "teacher" ? selectActiveTeachers : selectUsers);
  const people = state.status === "ready" ? state.data.filter((p) => p.role === role) : [];
  if (role === "teacher" && state.status === "ready" && people.length === 0) {
    return <Notice>{text.people.noActiveTeachers}</Notice>;
  }
  return (
    <SelectInput id={id} required value={value} onChange={(e) => onChange(e.target.value)} disabled={state.status !== "ready"}>
      <option value="">{state.status === "loading" ? t.common.loading : text.people.choose}</option>
      {people.map((person) => (
        <option key={person.firebase_uid} value={person.firebase_uid}>
          {displayName(person.full_name, t.common.unnamed)}
          {person.email ? ` — ${person.email}` : ""}
        </option>
      ))}
    </SelectInput>
  );
}

/** A name for an account id, from the people directory. */
export function usePeopleNames(): ReadonlyMap<string, string | null> {
  const { state } = useApi<Person[]>("/api/admin/users", selectUsers);
  return new Map(state.status === "ready" ? state.data.map((p) => [p.firebase_uid, p.full_name]) : []);
}

export function Saved({ show }: { readonly show: boolean }) {
  const { t } = useWorkspace();
  return show ? <Notice tone="success">{t.common.saved}</Notice> : null;
}

/** Tells the administrator which clock the schedule inputs use: the academy's, never the browser's. */
export function ZoneHint() {
  const text = useAdminText();
  const { fmt, timeZone } = useWorkspace();
  return <>{timeZone ? fmt(text.field.timeZoneHint, { zone: timeZone }) : text.field.timeZoneMissing}</>;
}

/** A datetime-local input value, read on the academy's clock, as an ISO instant (see wall-clock-input.ts). */
export const localToIso = wallClockInputToIso;

/** An ISO instant as a datetime-local input value on the academy's clock. */
export const isoToLocal = isoToWallClockInput;
