"use client";

import { Award, CalendarDays, ClipboardList, GraduationCap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { requestJson, useApi } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import {
  Eyebrow,
  ProgressBar,
  SectionHeader,
  StatusBadge,
} from "@/components/academy/workspace/dashboard";
import { INTL_LOCALE } from "@/lib/academy/workspace/format";
import { api, pages } from "@/components/academy/workspace/paths";
import { ReferralModule } from "@/components/academy/workspace/referral";
import { useUnreadNotifications } from "@/components/academy/workspace/shell";
import type {
  Announcements,
  AssignmentList,
  MyCertificates,
  MyLearning,
  ProgressView,
  Remediation,
  Threads,
} from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  EmptyState,
  LinkButton,
  Notice,
  TextLink,
} from "@/components/academy/workspace/ui";
import { cn } from "@/lib/utils";

/*
 * Learner home in the owner's reference composition, on Academy identity and
 * real data only: a welcome strip (the reference's streak chip has no live
 * counterpart, so the real active-classes chip takes its place), the classes
 * in progress with their live completion, the earned certificates as the
 * achievements row, then live sessions beside the truthful placement state
 * (the reference's Launch button would start a test that does not exist) and
 * the referral module (the live program counts joins and offers no rewards).
 * Below the reference's fold, the learner's real work stays: due work,
 * remediation nudges, announcements and the inbox. Presentation only.
 */
export default function LearnPage() {
  const { state, reload } = useApi<MyLearning>(api.myLearning);
  return (
    <ApiView state={state} onRetry={reload} loading={<PageSkeleton />}>
      {(data) => <Dashboard data={data} />}
    </ApiView>
  );
}

function PageSkeleton() {
  const pulse = "animate-pulse rounded-2xl border bg-muted/40 motion-reduce:animate-none";
  return (
    <div aria-hidden="true" className="space-y-8">
      <div className={cn(pulse, "min-h-28 rounded-3xl")} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(pulse, "min-h-36")} />
        <div className={cn(pulse, "min-h-36")} />
      </div>
      <div className={cn(pulse, "min-h-24")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={cn(pulse, "min-h-72")} />
        <div className="space-y-6">
          <div className={cn(pulse, "min-h-40")} />
          <div className={cn(pulse, "min-h-56")} />
        </div>
      </div>
    </div>
  );
}

/** One open work item, as the due-work hook reports it. */
interface OpenWork {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly returned: boolean;
}

/** Loads a per-class resource incrementally: each class paints as its own request settles. */
function usePerGroup<T>(classGroupIds: readonly string[], url: (id: string) => string, select: (data: unknown) => T) {
  const { user, isLoading } = useAuth();
  const [map, setMap] = useState<ReadonlyMap<string, T>>(new Map());
  const key = classGroupIds.join("|");
  useEffect(() => {
    if (isLoading || !user || key === "") return;
    let cancelled = false;
    for (const id of key.split("|")) {
      requestJson<unknown>(url(id)).then((result) => {
        if (cancelled || !result.ok) return;
        setMap((previous) => new Map(previous).set(id, select(result.data)));
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, user, isLoading]);
  return map;
}

const selectProgress = (data: unknown) => data as ProgressView;
const selectRemediation = (data: unknown) => (data as Remediation).filter((row) => row.state === "assigned").length;
const selectOpenWork = (data: unknown): readonly OpenWork[] => {
  const now = Date.now();
  return (data as AssignmentList).flatMap((entry) => {
    if (!("attempts" in entry)) return [];
    const latest = [...entry.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
    const needsWork = !latest || latest.state === "in_progress" || latest.state === "returned";
    if (!needsWork || Date.parse(entry.assignment.opensAt) > now) return [];
    return [{ id: entry.assignment.id, title: entry.assignment.title, dueAt: entry.assignment.dueAt, returned: latest?.state === "returned" }];
  });
};

function Dashboard({ data }: { readonly data: MyLearning }) {
  const { t, fmt, number, percent } = useWorkspace();
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || "";
  const active = data.classGroups.filter((entry) => entry.enrollmentState === "active");
  const activeIds = active.map((entry) => entry.classGroup.id);
  const names = new Map(data.classGroups.map((entry) => [entry.classGroup.id, entry.classGroup.name]));
  const progressMap = usePerGroup(activeIds, api.progress, selectProgress);
  const workMap = usePerGroup(activeIds, api.assignments, selectOpenWork);
  const remediationMap = usePerGroup(activeIds, (id) => api.remediation(id), selectRemediation);

  return (
    <div className="space-y-8">
      {/* 1 — Welcome strip: greeting, one line, and a real chip where the reference showed a streak. */}
      <header className="rounded-3xl border bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>{t.dashboard.greetingEyebrow}</Eyebrow>
            <h1 className="mt-1 break-words font-serif text-2xl sm:text-3xl">
              {displayName ? fmt(t.dashboard.greetingName, { name: displayName }) : t.dashboard.greeting}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.intro}</p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 text-sm font-medium">
            <GraduationCap aria-hidden="true" className="h-4 w-4 text-gold" />
            <span className="tabular-nums">{number(active.length)}</span> {t.dashboard.activeClasses}
          </p>
        </div>
        {active.map((entry) => (
          <RemediationNudge
            key={entry.classGroup.id}
            classGroupId={entry.classGroup.id}
            name={entry.classGroup.name}
            assigned={remediationMap.get(entry.classGroup.id) ?? 0}
          />
        ))}
      </header>

      {/* 2 — Continue your studies: real classes with their live completion. */}
      <section aria-label={t.dashboard.courses}>
        <SectionHeader eyebrow={t.dashboard.continueEyebrow} title={t.dashboard.inProgress} />
        {data.classGroups.length === 0 ? (
          <EmptyState action={<LinkButton href="/academy" variant="primary">{t.nav.catalog}</LinkButton>}>
            {t.learn.noClasses}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.classGroups.map((entry) => {
              const activeHere = entry.enrollmentState === "active";
              const lessons = progressMap.get(entry.classGroup.id)?.progress.lessons ?? null;
              const ratio = lessons && lessons.total > 0 ? lessons.completed / lessons.total : null;
              return (
                <li key={entry.enrollmentId} className="rounded-2xl border bg-card p-5 text-card-foreground">
                  <p className="break-words font-serif text-lg">{entry.course.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <bdi>{entry.classGroup.name}</bdi>
                    <StatusBadge map={t.learn.enrollment} value={entry.enrollmentState} tone={activeHere ? "strong" : "neutral"} />
                  </p>
                  {activeHere && ratio !== null && (
                    <div className="mt-4">
                      <ProgressBar value={ratio} label={fmt(t.classGroup.lessonsOf, { completed: lessons!.completed, total: lessons!.total })} />
                    </div>
                  )}
                  <p className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {activeHere && ratio !== null ? fmt(t.dashboard.percentComplete, { percent: percent(ratio) }) : ""}
                    </span>
                    {activeHere && <TextLink href={pages.classGroup(entry.classGroup.id)}>{t.learn.openClass}</TextLink>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3 — Achievements: the learner's real certificates. */}
      <AchievementsSection />

      {/* 4 — Live sessions beside the truthful placement state and the referral module. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label={t.learn.upcoming} className="rounded-2xl border bg-card p-5 text-card-foreground">
          <Eyebrow>
            <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
            {t.dashboard.calendarEyebrow}
          </Eyebrow>
          <h2 className="mt-1 font-serif text-2xl">{t.learn.upcoming}</h2>
          {data.upcomingSessions.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                <span className="font-medium text-foreground">{t.learn.noUpcoming}</span>
                <span className="mt-1 block">{t.dashboard.noUpcomingBody}</span>
              </EmptyState>
            </div>
          ) : (
            <ol className="mt-4 space-y-3">
              {data.upcomingSessions.map((session) => (
                <SessionRow key={session.id} session={session} groupName={session.classGroupId ? names.get(session.classGroupId) : undefined} />
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          {/* The reference's dark placement card, kept truthful: the test is not open, so no launch action exists. */}
          <section aria-label={t.dashboard.placement} className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <GraduationCap aria-hidden="true" className="h-6 w-6 text-gold" />
            <h2 className="mt-2 font-serif text-2xl">{t.dashboard.placement}</h2>
            <p className="mt-1 text-sm text-primary-foreground/80">{t.dashboard.placementUnavailable}</p>
          </section>
          <ReferralModule />
        </div>
      </div>

      {/* Below the reference's fold: the learner's real work and communication. */}
      <section aria-label={t.learn.work}>
        <SectionHeader eyebrow={t.dashboard.workEyebrow} title={t.learn.work} />
        {active.length === 0 ? (
          <EmptyState>{t.learn.noWork}</EmptyState>
        ) : (
          <DueWorkSection active={active} workMap={workMap} />
        )}
      </section>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <section aria-label={t.dashboard.announcements}>
          <SectionHeader title={t.dashboard.announcements} action={<TextLink href={pages.announcements}>{t.dashboard.viewAll}</TextLink>} />
          <LatestAnnouncements />
        </section>
        <section aria-label={t.dashboard.inbox}>
          <SectionHeader title={t.dashboard.inbox} />
          <InboxCard />
        </section>
      </div>
    </div>
  );
}

/** The learner's certificates as the achievements row; a truthful empty state otherwise. */
function AchievementsSection() {
  const { t, date, fmt } = useWorkspace();
  const { state, reload } = useApi<MyCertificates>(api.myCertificates);
  return (
    <section aria-label={t.nav.certificates}>
      <SectionHeader eyebrow={t.dashboard.achievementsEyebrow} title={t.nav.certificates} action={<TextLink href={pages.certificates}>{t.dashboard.viewAll}</TextLink>} />
      <ApiView state={state} onRetry={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <EmptyState icon={<Award aria-hidden="true" className="h-5 w-5" />}>{t.dashboard.noCertificates}</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-card-foreground">
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                    <Award className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{row.courseTitle}</span>
                    <span className="block text-sm text-muted-foreground">{fmt(t.dashboard.issuedOn, { date: date(row.issuedAt) })}</span>
                    <TextLink href={pages.verifyCertificate(row.code)}>{t.certificates.verify}</TextLink>
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      </ApiView>
    </section>
  );
}

/** One session row: dark date tile, context, state, actions (no preparation for learners). */
function SessionRow({
  session,
  groupName,
}: {
  readonly session: MyLearning["upcomingSessions"][number];
  readonly groupName: string | undefined;
}) {
  const { t, locale, timeZone, sessionTime } = useWorkspace();
  const date = new Date(session.startsAt);
  const valid = timeZone !== null && !Number.isNaN(date.getTime());
  const weekday = valid ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short", timeZone: timeZone! }).format(date) : null;
  const day = valid ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", timeZone: timeZone! }).format(date) : null;
  return (
    <li className="rounded-xl bg-muted/40 p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary text-center text-primary-foreground">
          {day ? (
            <span className="leading-tight">
              <span className="block text-[0.6rem] uppercase tracking-wide rtl:tracking-normal opacity-80">{weekday}</span>
              <span className="block font-serif text-xl tabular-nums">{day}</span>
            </span>
          ) : (
            <span className="text-xl">·</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{session.lessonTitle}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <time dateTime={session.startsAt}>{sessionTime(session.startsAt)}</time>
            {groupName && <bdi>{groupName}</bdi>}
            <StatusBadge map={t.classGroup.sessionState} value={session.state} tone={session.state === "live" ? "strong" : "neutral"} />
          </p>
          <p className="mt-1 text-sm">
            {session.classGroupId && (
              <TextLink href={pages.lessonSheet(session.classGroupId, session.lessonId)}>{t.session.lessonSheet}</TextLink>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
          {session.meetingUrl ? (
            <LinkButton href={session.meetingUrl} variant="primary" external>
              {t.learn.join}
            </LinkButton>
          ) : (
            /* An intentional, truthful disabled state: no link exists yet. */
            <span className="inline-flex min-h-9 cursor-not-allowed items-center justify-center rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground">
              {t.teach.joinUnavailable}
            </span>
          )}
          <LinkButton href={pages.session(session.id)}>{t.classGroup.openSession}</LinkButton>
        </div>
      </div>
    </li>
  );
}

/** A quiet warning shown only when this class has remedial activities still assigned. */
function RemediationNudge({
  classGroupId,
  name,
  assigned,
}: {
  readonly classGroupId: string;
  readonly name: string;
  readonly assigned: number;
}) {
  const { t, fmt } = useWorkspace();
  if (assigned === 0) return null;
  return (
    <div className="mt-3">
      <Notice tone="warning">
        {fmt(t.dashboard.remediationNudge, { name })}{" "}
        <TextLink href={pages.classGroup(classGroupId, "practice")}>{t.dashboard.openPractice}</TextLink>
      </Notice>
    </div>
  );
}

/** Open assignments per class group, from the shared incremental hook (no duplicate fetches). */
function DueWorkSection({
  active,
  workMap,
}: {
  readonly active: MyLearning["classGroups"];
  readonly workMap: ReadonlyMap<string, readonly OpenWork[]>;
}) {
  const { t, fmt, sessionTime } = useWorkspace();
  const now = Date.now();
  const withWork = active
    .map((entry) => ({ entry, open: workMap.get(entry.classGroup.id) }))
    .filter((row): row is { entry: (typeof active)[number]; open: readonly OpenWork[] } => row.open !== undefined && row.open.length > 0);
  const settled = active.every((entry) => workMap.has(entry.classGroup.id));
  if (withWork.length === 0) {
    return settled ? (
      <EmptyState>{t.learn.noWork}</EmptyState>
    ) : (
      <div aria-hidden="true" className="min-h-24 animate-pulse rounded-2xl border bg-muted/40 motion-reduce:animate-none" />
    );
  }
  return (
    <div className="space-y-4">
      {withWork.map(({ entry, open }) => (
        <div key={entry.classGroup.id} className="rounded-2xl border bg-card p-5 text-card-foreground">
          <h3 className="mb-3 font-serif text-lg">{entry.classGroup.name}</h3>
          <ul className="space-y-3">
            {open.map((item) => {
              const dueSoon = item.dueAt !== null && Date.parse(item.dueAt) - now < 72 * 3600e3;
              return (
                <li key={item.id} className="rounded-xl border p-3">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <TextLink href={pages.assignment(item.id)}>{item.title}</TextLink>
                    <span className="flex flex-wrap items-center gap-2">
                      {item.returned && <Badge tone="warning">{t.dashboard.returned}</Badge>}
                      {!item.returned && dueSoon && <Badge tone="warning">{t.dashboard.dueSoon}</Badge>}
                    </span>
                  </p>
                  {item.dueAt && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {fmt(t.common.dueOf, { time: sessionTime(item.dueAt) })}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** The two most recent announcements the learner can read. */
function LatestAnnouncements() {
  const { t, dateTime } = useWorkspace();
  const { state, reload } = useApi<Announcements>(api.announcements);
  return (
    <ApiView state={state} onRetry={reload}>
      {(items) =>
        items.length === 0 ? (
          <EmptyState>{t.announcements.empty}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 2).map((item) => (
              <li key={item.id} className="rounded-2xl border bg-card p-4 text-card-foreground">
                <p className="text-xs text-muted-foreground">
                  <time dateTime={item.publishedAt}>{dateTime(item.publishedAt)}</time>
                </p>
                <h3 className="mt-0.5 break-words font-medium">{item.title}</h3>
                <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ul>
        )
      }
    </ApiView>
  );
}

/** Real unread counts: notifications from the shell's shared request, messages from the thread list. */
function InboxCard() {
  const { t, fmt, number } = useWorkspace();
  const shared = useUnreadNotifications();
  const threads = useApi<Threads>(api.threads);
  const unreadNotifications = shared && shared.state.status === "ready" ? shared.state.data.unreadCount : null;
  const unreadMessages =
    threads.state.status === "ready" ? threads.state.data.reduce((sum, thread) => sum + thread.unread, 0) : null;
  const settled = unreadNotifications !== null && unreadMessages !== null;
  const caughtUp = unreadNotifications === 0 && unreadMessages === 0;
  return (
    <div className="rounded-2xl border bg-card p-5 text-card-foreground">
      <ul className="space-y-1 text-sm">
        {!settled && (
          <li aria-hidden="true" className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        )}
        {settled && caughtUp && <li className="text-muted-foreground">{t.dashboard.allCaughtUp}</li>}
        {unreadMessages !== null && unreadMessages > 0 && (
          <li className="font-medium">{fmt(t.dashboard.unreadMessages, { count: number(unreadMessages) })}</li>
        )}
        {unreadNotifications !== null && unreadNotifications > 0 && (
          <li className="font-medium">{fmt(t.dashboard.unreadNotifications, { count: number(unreadNotifications) })}</li>
        )}
      </ul>
      <p className="mt-3 flex flex-wrap gap-2">
        <LinkButton href={pages.messages}>{t.dashboard.openMessages}</LinkButton>
        <LinkButton href={pages.notifications}>{t.dashboard.openNotifications}</LinkButton>
      </p>
    </div>
  );
}
