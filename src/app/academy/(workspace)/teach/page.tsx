"use client";

import { CalendarClock, CalendarDays, ClipboardList, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useApi, usePerGroup } from "@/components/academy/workspace/api";
import { useWorkspace } from "@/components/academy/workspace/context";
import { Eyebrow, SectionHeader, StatCard, StatusBadge } from "@/components/academy/workspace/dashboard";
import { ReferralModule } from "@/components/academy/workspace/referral";
import { INTL_LOCALE } from "@/lib/academy/workspace/format";
import { api, pages } from "@/components/academy/workspace/paths";
import { useUnreadNotifications } from "@/components/academy/workspace/shell";
import type { MyTeaching, ReviewQueue, Threads } from "@/components/academy/workspace/types";
import {
  ApiView,
  Badge,
  DataTable,
  EmptyState,
  LinkButton,
  TextLink,
} from "@/components/academy/workspace/ui";
import { cn } from "@/lib/utils";

/*
 * Teacher home in the owner's reference composition, rebuilt on Academy
 * identity (deep navy, ivory, restrained gold) and real data only:
 *   1. a dark navy banner (eyebrow, serif greeting, real counts, next-session
 *      figure) — the reference's certification hero carried a mock course, so
 *      the real operations banner takes its place;
 *   2. Live Sessions rows with dark date tiles and a Join action beside
 *      "My classes" — which replaces the reference's Authoring Studio, an
 *      admin-only capability this product denies to teachers;
 *   3. three stat cards with the real operational counts (the reference's
 *      earnings/commission figures have no live counterpart);
 *   4. the referral module: link, copy and the real joined count — the live
 *      program offers no monetary rewards, so no tiers or amounts appear.
 * Presentation only: every value comes from the live APIs.
 */
export default function TeachPage() {
  const { state, reload } = useApi<MyTeaching>(api.myTeaching);
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
      <div className={cn(pulse, "min-h-44 rounded-3xl")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={cn(pulse, "min-h-72")} />
        <div className={cn(pulse, "min-h-72")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={cn(pulse, "min-h-28")} />
        <div className={cn(pulse, "min-h-28")} />
        <div className={cn(pulse, "min-h-28")} />
      </div>
      <div className={cn(pulse, "min-h-36")} />
    </div>
  );
}

/** One row of the aggregated review queue, carrying its group context. */
interface QueueRow {
  readonly attemptId: string;
  readonly assignmentTitle: string;
  readonly submittedAt: string | null;
  readonly state: string;
  readonly awaitingRelease: boolean;
  readonly isLate: boolean;
  readonly groupName: string;
  readonly classGroupId: string;
}

const selectQueue = (data: unknown) => data as ReviewQueue;

function Dashboard({ data }: { readonly data: MyTeaching }) {
  const { t, fmt, number, sessionTime, dateTime } = useWorkspace();
  const { user } = useAuth();
  const displayName = user?.displayName?.trim() || "";
  const names = new Map(data.classGroups.map((entry) => [entry.classGroup.id, entry.classGroup.name]));
  const running = data.classGroups.filter((entry) => entry.classGroup.status !== "cancelled");
  const runningIds = running.map((entry) => entry.classGroup.id);
  const queueMap = usePerGroup(runningIds, api.reviewQueue, selectQueue);
  const next = data.upcomingSessions[0];

  const queueSettled = running.every((entry) => queueMap.has(entry.classGroup.id));
  const waitingByGroup = new Map(
    running.map((entry) => {
      const rows = queueMap.get(entry.classGroup.id) ?? [];
      return [entry.classGroup.id, rows.filter((row) => row.state === "needs_review" || row.awaitingRelease).length];
    }),
  );
  const pendingReviews = [...waitingByGroup.values()].reduce((sum, count) => sum + count, 0);
  const toPrepare = data.upcomingSessions.filter((session) => session.preparationStatus !== "ready").length;
  const queueRows: QueueRow[] = running.flatMap((entry) =>
    (queueMap.get(entry.classGroup.id) ?? [])
      .filter((row) => row.state === "needs_review" || row.awaitingRelease)
      .map((row) => ({
        attemptId: row.attemptId,
        assignmentTitle: row.assignmentTitle,
        submittedAt: row.submittedAt ?? null,
        state: row.state,
        awaitingRelease: row.awaitingRelease,
        isLate: row.isLate,
        groupName: entry.classGroup.name,
        classGroupId: entry.classGroup.id,
      })),
  );
  queueRows.sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));

  return (
    <div className="space-y-8">
      {/* 1 — Dark banner: identity, real counts, the next session as the featured figure. */}
      <header className="rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
          <div className="min-w-0 flex-1 basis-80">
            <Eyebrow>{t.teach.title}</Eyebrow>
            <h1 className="mt-2 break-words font-serif text-3xl sm:text-4xl">
              {displayName ? fmt(t.teach.greetingName, { name: displayName }) : t.teach.greeting}
            </h1>
            <p className="mt-1.5 text-sm text-primary-foreground/80">{t.teach.intro2}</p>
            <p className="mt-5 flex flex-wrap gap-3">
              <Link
                href="#review-queue"
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-gold px-4 py-2 text-sm font-medium text-gold-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                {t.teach.goReview}
                {queueSettled && pendingReviews > 0 && <span className="ms-2 tabular-nums">({number(pendingReviews)})</span>}
              </Link>
              <Link
                href="#classes"
                className="inline-flex min-h-9 items-center justify-center rounded-full border border-primary-foreground/40 px-4 py-2 text-sm font-medium hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                {t.teach.goClasses}
              </Link>
            </p>
          </div>
          <div className="text-start sm:text-end">
            <p className="text-xs font-medium uppercase tracking-[0.2em] rtl:tracking-normal text-gold">{t.dashboard.nextSession}</p>
            {next ? (
              <>
                <p className="mt-1 font-serif text-3xl sm:text-4xl">
                  <NextFigure iso={next.startsAt} />
                </p>
                <p className="mt-1 max-w-64 truncate text-sm text-primary-foreground/80">{next.lessonTitle}</p>
                <p className="mt-0.5 text-xs text-primary-foreground/70">
                  <time dateTime={next.startsAt}>{sessionTime(next.startsAt)}</time>
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-primary-foreground/80">{t.dashboard.noNextSession}</p>
            )}
          </div>
        </div>
      </header>

      {/* 2 — Live sessions beside my classes, in the reference's two-card row. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label={t.teach.upcoming} className="rounded-2xl border bg-card p-5 text-card-foreground">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Eyebrow>
                <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
                {t.dashboard.calendarEyebrow}
              </Eyebrow>
              <h2 className="mt-1 font-serif text-2xl">{t.teach.upcoming}</h2>
            </div>
          </div>
          {data.upcomingSessions.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                <span className="font-medium text-foreground">{t.teach.noUpcoming}</span>
                <span className="mt-1 block">{t.teach.noUpcomingHint}</span>
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

        <section id="classes" aria-label={t.teach.classes} className="scroll-mt-6 rounded-2xl border bg-card p-5 text-card-foreground">
          <Eyebrow>
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            {t.teach.groupsEyebrow}
          </Eyebrow>
          <h2 className="mt-1 font-serif text-2xl">{t.teach.classes}</h2>
          {data.classGroups.length === 0 ? (
            <div className="mt-4">
              <EmptyState>
                <span className="font-medium text-foreground">{t.teach.noClasses}</span>
                <span className="mt-1 block">{t.teach.noGroupsHint}</span>
              </EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.classGroups.map((entry) => (
                <li key={entry.classGroup.id} className="rounded-xl bg-muted/40 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-serif text-lg">{entry.classGroup.name}</p>
                      <p className="text-sm text-muted-foreground">{entry.course.title}</p>
                      <p className="mt-1.5 flex flex-wrap gap-1.5">
                        <StatusBadge map={t.classGroup.status} value={entry.classGroup.status} />
                        <Badge>{fmt(t.teach.activeLearners, { count: entry.activeLearners })}</Badge>
                        {(waitingByGroup.get(entry.classGroup.id) ?? 0) > 0 && (
                          <Badge tone="warning">{fmt(t.classGroup.attemptsSummary, { count: waitingByGroup.get(entry.classGroup.id)! })}</Badge>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2">
                      <LinkButton href={pages.classGroup(entry.classGroup.id)} variant="primary">
                        {t.learn.openClass}
                      </LinkButton>
                      {(waitingByGroup.get(entry.classGroup.id) ?? 0) > 0 && (
                        <TextLink href={pages.classGroup(entry.classGroup.id, "review")}>{t.teach.openReview}</TextLink>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 3 — The three real operational counts, in the reference's stat-card row. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t.teach.activeGroups} value={number(running.length)} icon={<Users aria-hidden="true" className="h-4 w-4" />} />
        <StatCard
          label={t.teach.pendingReviews}
          value={
            queueSettled ? (
              number(pendingReviews)
            ) : (
              <span aria-hidden="true" className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle motion-reduce:animate-none" />
            )
          }
          icon={<ClipboardList aria-hidden="true" className="h-4 w-4" />}
        />
        <StatCard label={t.teach.toPrepare} value={number(toPrepare)} icon={<CalendarClock aria-hidden="true" className="h-4 w-4" />} />
      </div>

      {/* Review queue: the grading work behind the banner's primary action. */}
      <section id="review-queue" aria-label={t.teach.reviewQueue} className="scroll-mt-6">
        <SectionHeader eyebrow={t.teach.reviewEyebrow} title={t.teach.reviewQueue} />
        {!queueSettled && queueRows.length === 0 ? (
          <div aria-hidden="true" className="min-h-24 animate-pulse rounded-2xl border bg-muted/40 motion-reduce:animate-none" />
        ) : queueRows.length === 0 ? (
          <EmptyState>
            <span className="font-medium text-foreground">{t.teach.noReview}</span>
            <span className="mt-1 block">{t.teach.caughtUp}</span>
          </EmptyState>
        ) : (
          <DataTable
            caption={t.teach.reviewQueue}
            rows={queueRows}
            rowKey={(row) => row.attemptId}
            empty={t.teach.noReview}
            columns={[
              { key: "assignment", header: t.common.title, cell: (row) => <TextLink href={pages.attempt(row.attemptId)}>{row.assignmentTitle}</TextLink> },
              { key: "group", header: t.common.classGroup, cell: (row) => <TextLink href={pages.classGroup(row.classGroupId, "review")}><bdi>{row.groupName}</bdi></TextLink> },
              {
                key: "state",
                header: t.common.status,
                cell: (row) => (
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={row.state === "needs_review" ? "warning" : "neutral"}>
                      {row.awaitingRelease ? t.classGroup.awaitingRelease : t.assessment.state[row.state as keyof typeof t.assessment.state] ?? row.state}
                    </Badge>
                    {row.isLate && <Badge tone="warning">{t.classGroup.late}</Badge>}
                  </span>
                ),
              },
              { key: "submitted", header: t.common.details, cell: (row) => (row.submittedAt ? <time dateTime={row.submittedAt}>{dateTime(row.submittedAt)}</time> : "—") },
              {
                key: "open",
                header: <span className="sr-only">{t.teach.openReview}</span>,
                cell: (row) => <LinkButton href={pages.attempt(row.attemptId)}>{t.teach.openReview}</LinkButton>,
              },
            ]}
          />
        )}
      </section>

      {/* Communication at a glance. */}
      <section aria-label={t.dashboard.inbox} className="max-w-md">
        <SectionHeader title={t.dashboard.inbox} />
        <TeacherInbox />
      </section>

      {/* 4 — Referral, in the reference's wide-card composition; real fields only. */}
      <ReferralModule />
    </div>
  );
}

/** The banner's featured figure: weekday and day of the next session on the academy clock. */
function NextFigure({ iso }: { readonly iso: string }) {
  const { locale, timeZone } = useWorkspace();
  const date = new Date(iso);
  if (!timeZone || Number.isNaN(date.getTime())) return <>·</>;
  const weekday = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "long", timeZone }).format(date);
  const day = new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone }).format(date);
  return (
    <>
      {weekday} <span className="text-gold">{day}</span>
    </>
  );
}

/** One session row: dark date tile, context, prep chip, Join. */
function SessionRow({
  session,
  groupName,
}: {
  readonly session: MyTeaching["upcomingSessions"][number];
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
            <Badge tone={session.preparationStatus === "ready" ? "strong" : "warning"}>
              {t.session.prepStatus[session.preparationStatus as keyof typeof t.session.prepStatus] ?? session.preparationStatus}
            </Badge>
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

/** Real unread counts: notifications from the shell's shared request, messages from the thread list. */
function TeacherInbox() {
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
