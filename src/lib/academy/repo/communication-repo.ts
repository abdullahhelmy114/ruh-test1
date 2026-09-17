/**
 * Persistence for message threads, messages, announcements and notifications.
 *
 * Every thread and notification query is keyed by the caller's uid, and a
 * message can only be inserted into a thread whose participants include its
 * sender (checked in SQL, not only in code).
 */
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import type {
  AnnouncementRecord,
  AnnouncementScope,
  MessageRecord,
  NotificationKind,
  NotificationRecord,
  ThreadRecord,
} from "../communication/messaging.ts";
import { iso, isoOrNull, num, str, strOrNull } from "./rows.ts";

// ---------------------------------------------------------------------------
// Threads and messages
// ---------------------------------------------------------------------------

const THREAD_COLUMNS = `id, participant_low_uid, participant_high_uid, class_group_id, created_by, created_at, last_message_at`;

export function selectThreadQuery(id: string): SqlQuery {
  return { text: `SELECT ${THREAD_COLUMNS} FROM academy_message_threads WHERE id = $1::uuid`, values: [id] };
}

export function selectThreadByPairQuery(low: string, high: string, classGroupId: string | null): SqlQuery {
  return {
    text: `SELECT ${THREAD_COLUMNS} FROM academy_message_threads
      WHERE participant_low_uid = $1 AND participant_high_uid = $2 AND class_group_id IS NOT DISTINCT FROM $3::uuid`,
    values: [low, high, classGroupId],
  };
}

/**
 * The caller's conversations, newest activity first, with a preview, unread
 * count, the other participant's display name and the class group's name.
 */
export function listUserThreadsQuery(uid: string): SqlQuery {
  return {
    text: `SELECT t.id, t.participant_low_uid, t.participant_high_uid, t.class_group_id, t.created_by, t.created_at, t.last_message_at,
        (SELECT p.full_name FROM profiles p
          WHERE p.firebase_uid = CASE WHEN t.participant_low_uid = $1 THEN t.participant_high_uid ELSE t.participant_low_uid END) AS other_name,
        (SELECT cg.name FROM academy_class_groups cg WHERE cg.id = t.class_group_id) AS class_group_name,
        (SELECT m.body FROM academy_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body,
        (SELECT count(*) FROM academy_messages m
          WHERE m.thread_id = t.id AND m.sender_uid <> $1
            AND m.created_at > COALESCE((SELECT r.last_read_at FROM academy_thread_reads r WHERE r.thread_id = t.id AND r.reader_uid = $1), '-infinity'::timestamptz)
        ) AS unread
      FROM academy_message_threads t
      WHERE t.participant_low_uid = $1 OR t.participant_high_uid = $1
      ORDER BY t.last_message_at DESC NULLS LAST, t.id DESC
      LIMIT 200`,
    values: [uid],
  };
}

/** A conversation partner's display name (never contact details). */
export function selectDisplayNameQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT full_name FROM profiles WHERE firebase_uid = ${uid}`;
}

export function insertThreadQuery(thread: ThreadRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_message_threads
      (id, participant_low_uid, participant_high_uid, class_group_id, created_by, created_at, last_message_at)
    VALUES (${thread.id}::uuid, ${thread.participantLowUid}, ${thread.participantHighUid}, ${thread.classGroupId}::uuid,
      ${thread.createdBy}, ${thread.createdAt}::timestamptz, NULL)
    ON CONFLICT DO NOTHING
    RETURNING id`;
}

export function listThreadMessagesQuery(threadId: string, before: string | null, limit: number): SqlQuery {
  return {
    text: `SELECT id, thread_id, sender_uid, body, created_at FROM academy_messages
      WHERE thread_id = $1::uuid AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
      ORDER BY created_at DESC, id DESC LIMIT $3`,
    values: [threadId, before, Math.min(Math.max(Math.trunc(limit), 1), 100)],
  };
}

/** Inserts only when the sender is a participant of the thread. */
export function insertMessageQuery(message: MessageRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_messages (id, thread_id, sender_uid, body, created_at)
    SELECT ${message.id}::uuid, t.id, ${message.senderUid}::text, ${message.body}::text, ${message.createdAt}::timestamptz
    FROM academy_message_threads t
    WHERE t.id = ${message.threadId}::uuid AND (t.participant_low_uid = ${message.senderUid}::text OR t.participant_high_uid = ${message.senderUid}::text)
    RETURNING id`;
}

export function touchThreadQuery(threadId: string, at: string): SqlQuery {
  return sqlQuery`UPDATE academy_message_threads SET last_message_at = ${at}::timestamptz WHERE id = ${threadId}::uuid RETURNING id`;
}

export function upsertThreadReadQuery(threadId: string, readerUid: string, at: string): SqlQuery {
  return sqlQuery`INSERT INTO academy_thread_reads (thread_id, reader_uid, last_read_at)
    VALUES (${threadId}::uuid, ${readerUid}, ${at}::timestamptz)
    ON CONFLICT (thread_id, reader_uid) DO UPDATE SET last_read_at = GREATEST(academy_thread_reads.last_read_at, EXCLUDED.last_read_at)
    RETURNING thread_id`;
}

export function mapThreadRow(row: SqlRow): ThreadRecord {
  return Object.freeze({
    id: str(row.id),
    participantLowUid: str(row.participant_low_uid),
    participantHighUid: str(row.participant_high_uid),
    classGroupId: strOrNull(row.class_group_id),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    lastMessageAt: isoOrNull(row.last_message_at),
  });
}

export function mapMessageRow(row: SqlRow): MessageRecord {
  return Object.freeze({
    id: str(row.id),
    threadId: str(row.thread_id),
    senderUid: str(row.sender_uid),
    body: str(row.body),
    createdAt: iso(row.created_at),
  });
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

const ANNOUNCEMENT_COLUMNS = `id, scope, course_id, class_group_id, title, body, author_uid, state, published_at, withdrawn_at, withdrawn_by,
  withdraw_reason, revision`;

export function selectAnnouncementQuery(id: string): SqlQuery {
  return { text: `SELECT ${ANNOUNCEMENT_COLUMNS} FROM academy_announcements WHERE id = $1::uuid`, values: [id] };
}

/** What a class group's participants see: academy-wide, their course, and their class group. */
export function listClassGroupAnnouncementsQuery(classGroupId: string, courseId: string): SqlQuery {
  return {
    text: `SELECT ${ANNOUNCEMENT_COLUMNS} FROM academy_announcements
      WHERE state = 'published'
        AND (scope = 'academy' OR (scope = 'course' AND course_id = $2::uuid) OR (scope = 'class_group' AND class_group_id = $1::uuid))
      ORDER BY published_at DESC, id DESC LIMIT 100`,
    values: [classGroupId, courseId],
  };
}

export function listAcademyAnnouncementsQuery(): SqlQuery {
  return {
    text: `SELECT ${ANNOUNCEMENT_COLUMNS} FROM academy_announcements WHERE state = 'published' AND scope = 'academy'
      ORDER BY published_at DESC, id DESC LIMIT 100`,
    values: [],
  };
}

export function insertAnnouncementQuery(record: AnnouncementRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_announcements
      (id, scope, course_id, class_group_id, title, body, author_uid, state, published_at, revision)
    VALUES (${record.id}::uuid, ${record.scope}, ${record.courseId}::uuid, ${record.classGroupId}::uuid, ${record.title}, ${record.body},
      ${record.authorUid}, ${record.state}, ${record.publishedAt}::timestamptz, ${record.revision})
    RETURNING id`;
}

export function withdrawAnnouncementQuery(record: AnnouncementRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_announcements SET
      state = ${record.state}, withdrawn_at = ${record.withdrawnAt}::timestamptz, withdrawn_by = ${record.withdrawnBy},
      withdraw_reason = ${record.withdrawReason}, revision = ${record.revision}
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision} AND state = 'published'
    RETURNING id`;
}

/**
 * One notification per participant of the announcement's class group(s):
 * active learners and assigned teachers, excluding the author.
 */
export function fanOutAnnouncementNotificationsQuery(record: AnnouncementRecord, title: string, link: string): SqlQuery {
  return sqlQuery`INSERT INTO academy_notifications (id, recipient_uid, kind, title, link, source_id, created_at, read_at)
    SELECT gen_random_uuid(), p.uid, 'announcement', ${title}::text, ${link}::text, ${record.id}::uuid, ${record.publishedAt}::timestamptz, NULL
    FROM (
      SELECT e.learner_uid AS uid FROM academy_enrollments e
      JOIN academy_class_groups cg ON cg.id = e.class_group_id
      WHERE e.state = 'active' AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
        AND ((${record.scope}::text = 'class_group' AND cg.id = ${record.classGroupId}::uuid)
          OR (${record.scope}::text = 'course' AND cg.course_id = ${record.courseId}::uuid))
      UNION
      SELECT t.teacher_uid AS uid FROM academy_class_group_teachers t
      JOIN academy_class_groups cg ON cg.id = t.class_group_id
      WHERE t.unassigned_at IS NULL AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
        AND ((${record.scope}::text = 'class_group' AND cg.id = ${record.classGroupId}::uuid)
          OR (${record.scope}::text = 'course' AND cg.course_id = ${record.courseId}::uuid))
    ) p
    WHERE p.uid <> ${record.authorUid}::text
    ON CONFLICT DO NOTHING`;
}

export function mapAnnouncementRow(row: SqlRow): AnnouncementRecord {
  return Object.freeze({
    id: str(row.id),
    scope: str(row.scope) as AnnouncementScope,
    courseId: strOrNull(row.course_id),
    classGroupId: strOrNull(row.class_group_id),
    title: str(row.title),
    body: str(row.body),
    authorUid: str(row.author_uid),
    state: str(row.state) as AnnouncementRecord["state"],
    publishedAt: iso(row.published_at),
    withdrawnAt: isoOrNull(row.withdrawn_at),
    withdrawnBy: strOrNull(row.withdrawn_by),
    withdrawReason: strOrNull(row.withdraw_reason),
    revision: num(row.revision),
  });
}

// ---------------------------------------------------------------------------
// Notifications (always keyed by recipient)
// ---------------------------------------------------------------------------

const NOTIFICATION_COLUMNS = `id, recipient_uid, kind, title, link, source_id, created_at, read_at`;

/** Creates or refreshes the recipient's notification for a source (one per conversation, attempt, ...). */
export function upsertNotificationQuery(record: NotificationRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_notifications (id, recipient_uid, kind, title, link, source_id, created_at, read_at)
    VALUES (${record.id}::uuid, ${record.recipientUid}, ${record.kind}, ${record.title}, ${record.link}, ${record.sourceId}::uuid,
      ${record.createdAt}::timestamptz, NULL)
    ON CONFLICT (recipient_uid, kind, source_id) DO UPDATE SET title = EXCLUDED.title, link = EXCLUDED.link,
      created_at = EXCLUDED.created_at, read_at = NULL
    RETURNING id`;
}

export function listNotificationsQuery(uid: string, options: { readonly unreadOnly: boolean; readonly before: string | null }): SqlQuery {
  return {
    text: `SELECT ${NOTIFICATION_COLUMNS} FROM academy_notifications
      WHERE recipient_uid = $1 AND (NOT $2::boolean OR read_at IS NULL) AND ($3::timestamptz IS NULL OR created_at < $3::timestamptz)
      ORDER BY created_at DESC, id DESC LIMIT 100`,
    values: [uid, options.unreadOnly, options.before],
  };
}

export function unreadNotificationCountQuery(uid: string): SqlQuery {
  return sqlQuery`SELECT count(*) AS n FROM academy_notifications WHERE recipient_uid = ${uid} AND read_at IS NULL`;
}

export function markNotificationReadQuery(uid: string, id: string, at: string): SqlQuery {
  return sqlQuery`UPDATE academy_notifications SET read_at = COALESCE(read_at, ${at}::timestamptz)
    WHERE id = ${id}::uuid AND recipient_uid = ${uid}
    RETURNING id`;
}

export function markAllNotificationsReadQuery(uid: string, at: string): SqlQuery {
  return sqlQuery`UPDATE academy_notifications SET read_at = ${at}::timestamptz WHERE recipient_uid = ${uid} AND read_at IS NULL`;
}

export function mapNotificationRow(row: SqlRow): NotificationRecord {
  return Object.freeze({
    id: str(row.id),
    recipientUid: str(row.recipient_uid),
    kind: str(row.kind) as NotificationKind,
    title: str(row.title),
    link: strOrNull(row.link),
    sourceId: str(row.source_id),
    createdAt: iso(row.created_at),
    readAt: isoOrNull(row.read_at),
  });
}
