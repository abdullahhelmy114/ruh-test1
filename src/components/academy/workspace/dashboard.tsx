"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { INTL_LOCALE } from "@/lib/academy/workspace/format";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { pages } from "./paths";
import type { SessionRow } from "./sessions";
import { Badge, EmptyState, LinkButton, TextLink } from "./ui";

/*
 * Presentation components for the learner dashboard. Purely visual: every
 * value rendered here comes from the live APIs, and every action goes to the
 * same routes the plain screens use. Theme tokens and logical properties
 * only, matching the rest of the workspace.
 */

/** Serif section heading with an optional small gold eyebrow, in the academy's editorial voice. */
export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  readonly eyebrow?: ReactNode;
  readonly title: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">
            <span aria-hidden="true" className="h-px w-4 bg-gold" />
            {eyebrow}
          </p>
        )}
        <h2 className="mt-0.5 break-words font-serif text-xl sm:text-2xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** The dashboard surface: a softly elevated card. `accent` adds a start-side rule. */
export function DashboardCard({
  children,
  className,
  accent = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 text-card-foreground",
        accent && "border-s-4 border-s-gold",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A quiet progress bar. `value` is a 0–1 ratio from the progress API, never invented. */
export function ProgressBar({ value, label }: { readonly value: number; readonly label: string }) {
  const { percent } = useWorkspace();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{percent(clamped)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * A localized state badge. The underlying value is never changed: `map` is a
 * dictionary section (for example t.classGroup.sessionState) and unknown
 * values fall back to the raw string rather than hiding the state.
 */
export function StatusBadge({
  map,
  value,
  tone = "neutral",
}: {
  readonly map: Readonly<Record<string, string>>;
  readonly value: string;
  readonly tone?: "neutral" | "strong" | "warning";
}) {
  return <Badge tone={tone}>{map[value] ?? value}</Badge>;
}

/** A quick-action tile linking to an existing live feature. */
export function QuickAction({
  href,
  label,
  hint,
  icon,
}: {
  readonly href: string;
  readonly label: string;
  readonly hint?: string;
  readonly icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {icon && (
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
    </Link>
  );
}

/** A compact stat for the welcome panel. Values come from live data only. */
export function WelcomeStat({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Upcoming sessions as calendar-style rows: a date tile on the academy's
 * clock, the lesson and class, the localized state, and the same actions the
 * plain list offered. The Join button appears only when the server sent a
 * meeting link; nothing here creates or invents a meeting.
 */
export function UpcomingSessionsCard({
  sessions,
  classGroupNames,
  empty,
}: {
  readonly sessions: readonly SessionRow[];
  readonly classGroupNames?: ReadonlyMap<string, string>;
  readonly empty: string;
}) {
  const { t, locale, timeZone, sessionTime } = useWorkspace();
  const formats = useMemo(
    () =>
      timeZone
        ? {
            day: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", timeZone }),
            month: new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "short", timeZone }),
          }
        : null,
    [locale, timeZone],
  );
  if (sessions.length === 0) return <EmptyState>{empty}</EmptyState>;
  const dayFormat = formats?.day ?? null;
  const monthFormat = formats?.month ?? null;
  return (
    <ol className="space-y-3">
      {sessions.map((session) => {
        const groupId = session.classGroupId ?? "";
        const groupName = classGroupNames && groupId ? classGroupNames.get(groupId) : undefined;
        const date = new Date(session.startsAt);
        const valid = !Number.isNaN(date.getTime());
        return (
          <li key={session.id} className="flex gap-3 rounded-xl border bg-card p-3">
            <div
              aria-hidden="true"
              className="grid h-14 min-w-14 shrink-0 place-items-center rounded-lg bg-primary/10 px-1 text-primary"
            >
              {dayFormat && monthFormat && valid ? (
                <span className="text-center leading-tight">
                  <span className="block font-serif text-xl tabular-nums">{dayFormat.format(date)}</span>
                  <span className="block text-[0.65rem] uppercase tracking-wide rtl:tracking-normal">{monthFormat.format(date)}</span>
                </span>
              ) : (
                <span className="text-xl">·</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                <time dateTime={session.startsAt}>{sessionTime(session.startsAt)}</time>
                {groupName ? <> {"· "}<bdi>{groupName}</bdi></> : null}
              </p>
              <p className="break-words font-medium">{session.lessonTitle}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge
                  map={t.classGroup.sessionState}
                  value={session.state}
                  tone={session.state === "live" ? "strong" : "neutral"}
                />
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2">
                {session.meetingUrl && (
                  <LinkButton href={session.meetingUrl} variant="primary" external>
                    {t.learn.join}
                  </LinkButton>
                )}
                <LinkButton href={pages.session(session.id)}>{t.classGroup.openSession}</LinkButton>
                {groupId && <TextLink href={pages.lessonSheet(groupId, session.lessonId)}>{t.session.lessonSheet}</TextLink>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
