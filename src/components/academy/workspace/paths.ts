/** Workspace page and API paths in one place. Ids are always URI-encoded. */

const e = encodeURIComponent;

export const pages = {
  learn: "/academy/learn",
  teach: "/academy/teach",
  manage: "/academy/manage",
  messages: "/academy/messages",
  notifications: "/academy/notifications",
  announcements: "/academy/announcements",
  certificates: "/academy/certificates",
  approvals: "/academy/approvals",
  teacherApplication: "/academy/teacher-application",
  verifyCertificate: (code: string) => `/academy/certificates/verify?code=${e(code)}`,
  classGroup: (id: string, tab?: string) => `/academy/class-groups/${e(id)}${tab ? `?tab=${e(tab)}` : ""}`,
  lessonSheet: (classGroupId: string, lessonId: string) => `/academy/class-groups/${e(classGroupId)}/lessons/${e(lessonId)}`,
  content: (classGroupId: string, itemId: string) => `/academy/class-groups/${e(classGroupId)}/content/${e(itemId)}`,
  session: (id: string) => `/academy/sessions/${e(id)}`,
  assignment: (id: string) => `/academy/assignments/${e(id)}`,
  attempt: (id: string) => `/academy/attempts/${e(id)}`,
  thread: (id: string) => `/academy/messages/${e(id)}`,
  book: (id: string, page?: number) => `/academy/library/books/${e(id)}${page ? `?page=${page}` : ""}`,
  recording: (id: string) => `/academy/recordings/${e(id)}`,
  approval: (id: string) => `/academy/approvals/${e(id)}`,
};

/**
 * The academy home for a signed-in account (navigation only; pages and APIs
 * authorize on the server). A teacher account reaches teaching only when its
 * status is "active"; otherwise its home is its application page.
 */
export function academyHome(role: string | null | undefined, status?: string | null): string {
  if (role === "admin") return pages.manage;
  if (role === "teacher") return status === "active" ? pages.teach : pages.teacherApplication;
  return pages.learn;
}

export const api = {
  myLearning: "/api/academy/me/learning",
  myTeaching: "/api/academy/me/teaching",
  myCertificates: "/api/academy/me/certificates",
  checkout: (id: string) => `/api/academy/checkouts/${e(id)}`,
  teacherApplication: "/api/academy/teacher-application",
  myAttendance: (classGroupId: string) => `/api/academy/me/attendance?classGroupId=${e(classGroupId)}`,
  classGroup: (id: string) => `/api/academy/class-groups/${e(id)}`,
  roster: (id: string) => `/api/academy/class-groups/${e(id)}/roster`,
  lessonSheets: (id: string) => `/api/academy/class-groups/${e(id)}/lesson-sheets`,
  lessonSheet: (id: string, lessonId: string) => `/api/academy/class-groups/${e(id)}/lesson-sheets/${e(lessonId)}`,
  annotations: (id: string, lessonId: string) => `/api/academy/class-groups/${e(id)}/lesson-sheets/${e(lessonId)}/annotations`,
  annotation: (id: string) => `/api/academy/annotations/${e(id)}`,
  assignments: (id: string) => `/api/academy/class-groups/${e(id)}/assignments`,
  progress: (id: string, learnerUid?: string) => `/api/academy/class-groups/${e(id)}/progress${learnerUid ? `?learnerUid=${e(learnerUid)}` : ""}`,
  reviewQueue: (id: string) => `/api/academy/class-groups/${e(id)}/review-queue`,
  readings: (id: string) => `/api/academy/class-groups/${e(id)}/readings`,
  recordings: (id: string) => `/api/academy/class-groups/${e(id)}/recordings`,
  classAnnouncements: (id: string) => `/api/academy/class-groups/${e(id)}/announcements`,
  content: (id: string) => `/api/academy/class-groups/${e(id)}/content`,
  contentItem: (id: string, itemId: string) => `/api/academy/class-groups/${e(id)}/content/${e(itemId)}`,
  practiceResults: (id: string, learnerUid?: string) => `/api/academy/class-groups/${e(id)}/practice-results${learnerUid ? `?learnerUid=${e(learnerUid)}` : ""}`,
  remediation: (id: string, learnerUid?: string) => `/api/academy/class-groups/${e(id)}/remediation${learnerUid ? `?learnerUid=${e(learnerUid)}` : ""}`,
  remediationAssignment: (id: string) => `/api/academy/remediation/${e(id)}`,
  report: (id: string) => `/api/academy/class-groups/${e(id)}/report`,
  session: (id: string) => `/api/academy/sessions/${e(id)}`,
  sessionAttendance: (id: string) => `/api/academy/sessions/${e(id)}/attendance`,
  preparation: (id: string) => `/api/academy/sessions/${e(id)}/preparation`,
  assignment: (id: string) => `/api/academy/assignments/${e(id)}`,
  attempts: (assignmentId: string) => `/api/academy/assignments/${e(assignmentId)}/attempts`,
  attempt: (id: string) => `/api/academy/attempts/${e(id)}`,
  attemptRemediation: (id: string) => `/api/academy/attempts/${e(id)}/remediation`,
  threads: "/api/academy/messages/threads",
  thread: (id: string, before?: string) => `/api/academy/messages/threads/${e(id)}${before ? `?before=${e(before)}` : ""}`,
  notifications: (unreadOnly: boolean) => `/api/academy/notifications${unreadOnly ? "?unreadOnly=true" : ""}`,
  notification: (id: string) => `/api/academy/notifications/${e(id)}`,
  announcements: "/api/academy/announcements",
  announcement: (id: string) => `/api/academy/announcements/${e(id)}`,
  book: (id: string) => `/api/academy/library/books/${e(id)}`,
  bookPage: (id: string, page: number) => `/api/academy/library/books/${e(id)}/pages/${page}`,
  bookProgress: (id: string) => `/api/academy/library/books/${e(id)}/progress`,
  recording: (id: string) => `/api/academy/recordings/${e(id)}`,
  gates: "/api/academy/approval-gates",
  gate: (id: string) => `/api/academy/approval-gates/${e(id)}`,
};
