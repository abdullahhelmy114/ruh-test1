// Signed-in learner, teacher and administrator flows.
//
// BLOCKED until an authorised non-production environment exists: they need a
// build connected to a migrated development database (migrations 0001-0010
// applied there, ACADEMY_CORE_SCHEMA_READY=true), a non-production Firebase
// project, the six test accounts below, and seeded academy data. Credentials
// are never stored in the repository: sign each test account in once in a
// headed browser and save its storage state (cookies and IndexedDB, where
// Firebase keeps the session) to a file outside the repository, then point
// the variables below at those files. See tests/e2e/README.md.
//
//   E2E_STUDENT_STATE, E2E_TEACHER_STATE, E2E_ADMIN_STATE   storage state files (Student A, Teacher A, Admin)
//   E2E_STUDENT_B_STATE, E2E_TEACHER_B_STATE   a learner and a teacher of a different class group
//   E2E_PENDING_TEACHER_STATE   a teacher account whose application is under review
//   E2E_ALLOWED_HOSTS    the Firebase hosts the non-production project uses
//   E2E_CLASS_GROUP_ID   a class group with the student enrolled and the teacher assigned
//   E2E_RELEASED_LESSON_ID, E2E_UNRELEASED_LESSON_ID   lessons of that class group
//   E2E_ASSIGNMENT_ID    an open assignment of that class group
//   E2E_SESSION_ID       a started session of that class group
//   E2E_OTHER_ATTEMPT_ID an attempt belonging to a different learner
import { ADMIN_MESSAGES } from "../../../src/lib/academy/workspace/admin-messages.ts";
import { WORKSPACE_MESSAGES } from "../../../src/lib/academy/workspace/messages.ts";
import { expect, expectNoHorizontalScroll, test } from "./fixtures.mjs";

const t = WORKSPACE_MESSAGES.en;
const a = ADMIN_MESSAGES.en;
const env = process.env;
const need = (...names) => names.filter((name) => !env[name]);

function skipUnless(...names) {
  const missing = need(...names);
  test.skip(missing.length > 0, `needs ${missing.join(", ")} (see tests/e2e/README.md)`);
}

/** Every academy API response the page receives, for privacy assertions. */
function recordAcademyResponses(page) {
  const seen = [];
  page.on("response", async (response) => {
    if (!response.url().includes("/api/academy/")) return;
    seen.push({ url: response.url(), status: response.status(), body: await response.text().catch(() => "") });
  });
  return seen;
}

test.describe("learner", () => {
  test.use({ storageState: env.E2E_STUDENT_STATE || undefined });

  test("home lists classes and upcoming sessions on a phone", async ({ page }) => {
    skipUnless("E2E_STUDENT_STATE");
    await page.goto("/academy/learn");
    await expect(page.getByRole("heading", { name: t.learn.title })).toBeVisible();
    await expect(page.getByText(new RegExp(`${t.learn.classes}|${t.learn.noClasses}`)).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a Lesson Sheet before its release shows only when it opens, and no content is fetched", async ({ page }) => {
    skipUnless("E2E_STUDENT_STATE", "E2E_CLASS_GROUP_ID", "E2E_UNRELEASED_LESSON_ID");
    const responses = recordAcademyResponses(page);
    await page.goto(`/academy/class-groups/${env.E2E_CLASS_GROUP_ID}/lessons/${env.E2E_UNRELEASED_LESSON_ID}`);
    await expect(page.getByText(/This Lesson Sheet (opens on|is not available yet)/)).toBeVisible();
    const sheet = responses.filter((r) => r.url.includes(`/lesson-sheets/${env.E2E_UNRELEASED_LESSON_ID}`));
    expect(sheet.length).toBeGreaterThan(0);
    for (const response of sheet) {
      expect(response.status).toBe(403);
      expect(response.body).not.toMatch(/"blocks"|"content"/);
    }
  });

  test("a released Lesson Sheet takes a private note that only the learner sees", async ({ page }) => {
    skipUnless("E2E_STUDENT_STATE", "E2E_CLASS_GROUP_ID", "E2E_RELEASED_LESSON_ID");
    await page.goto(`/academy/class-groups/${env.E2E_CLASS_GROUP_ID}/lessons/${env.E2E_RELEASED_LESSON_ID}`);
    await expect(page.getByText(t.lesson.notesPrivate)).toBeVisible();
    const note = `e2e note ${Date.now()}`;
    await page.getByRole("button", { name: t.lesson.addNote }).first().click();
    await page.getByRole("textbox", { name: t.lesson.noteText }).first().fill(note);
    await page.getByRole("button", { name: t.lesson.saveNote }).first().click();
    await expect(page.getByText(note)).toBeVisible();
  });

  test("an assignment attempt is submitted and its result stays hidden until released", async ({ page }) => {
    skipUnless("E2E_STUDENT_STATE", "E2E_ASSIGNMENT_ID");
    const responses = recordAcademyResponses(page);
    await page.goto(`/academy/assignments/${env.E2E_ASSIGNMENT_ID}`);
    const start = page.getByRole("button", { name: t.assessment.start });
    // The page loads its data after hydration: wait until it offers either a new or an open attempt.
    await expect(start.or(page.getByRole("button", { name: t.assessment.submit }))).toBeVisible();
    if (await start.isVisible()) await start.click();
    // Submitting asks for confirmation in place (no modal dialog).
    await page.getByRole("button", { name: t.assessment.submit }).click();
    await page.getByRole("group", { name: t.assessment.submitConfirm }).getByRole("button", { name: t.common.confirm }).click();
    await expect(page.getByText(t.attempt.pending)).toBeVisible();
    for (const response of responses) expect(response.body).not.toMatch(/"correctIndex"\s*:|"answerKey"\s*:|"acceptedAnswers"\s*:/);
  });

  test("a learner reaches neither administration data nor another learner's attempt", async ({ page }) => {
    skipUnless("E2E_STUDENT_STATE", "E2E_OTHER_ATTEMPT_ID");
    await page.goto("/academy/manage");
    await expect(page.getByText(t.states.forbidden)).toBeVisible();
    await page.goto(`/academy/attempts/${env.E2E_OTHER_ATTEMPT_ID}`);
    await expect(page.getByText(new RegExp(`${t.states.forbidden}|${t.states.notFound}`))).toBeVisible();
    const direct = await page.request.get(`/api/academy/attempts/${env.E2E_OTHER_ATTEMPT_ID}`);
    expect([403, 404]).toContain(direct.status());
  });
});

test.describe("teacher", () => {
  test.use({ storageState: env.E2E_TEACHER_STATE || undefined });

  test("teaching home and a class group's review tab", async ({ page }) => {
    skipUnless("E2E_TEACHER_STATE", "E2E_CLASS_GROUP_ID");
    await page.goto("/academy/teach");
    await expect(page.getByRole("heading", { name: t.teach.title })).toBeVisible();
    await page.goto(`/academy/class-groups/${env.E2E_CLASS_GROUP_ID}?tab=review`);
    await expect(page.getByRole("tab", { name: t.classGroup.tabs.review })).toHaveAttribute("aria-selected", "true");
  });

  test("attendance is recorded for a started session, and preparation notes stay private", async ({ page }) => {
    skipUnless("E2E_TEACHER_STATE", "E2E_SESSION_ID");
    await page.goto(`/academy/sessions/${env.E2E_SESSION_ID}`);
    await expect(page.getByText(t.session.prepNotesHint)).toBeVisible();
    const save = page.getByRole("button", { name: t.session.saveAttendance });
    await expect(save.or(page.getByText(t.session.vocabularyMissing))).toBeVisible();
    if (await save.isVisible()) {
      // Save stays disabled until a mark changes; mark an unmarked learner so there is something to record.
      const firstMark = page.locator('select[id^="mark-"]').first();
      if ((await firstMark.inputValue()) === "") {
        await firstMark.selectOption({ index: 1 });
        await save.click();
        await expect(page.getByText(t.common.saved)).toBeVisible();
      } else {
        await expect(save).toBeDisabled();
      }
      await expect(page.getByText(t.states.conflict)).toHaveCount(0);
    }
  });
});

test.describe("administrator", () => {
  test.use({ storageState: env.E2E_ADMIN_STATE || undefined });

  test("overview and programs at tablet width", async ({ page }) => {
    skipUnless("E2E_ADMIN_STATE");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/academy/manage");
    await expect(page.getByRole("heading", { name: a.overview.title })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a program is created at authoring width and appears in the audit trail", async ({ page }) => {
    skipUnless("E2E_ADMIN_STATE");
    await page.setViewportSize({ width: 1024, height: 900 });
    const stamp = Date.now().toString(36);
    await page.goto("/academy/manage/catalog");
    await page.getByText(a.catalog.newProgram).click();
    await page.locator("#program-title").fill(`E2E program ${stamp}`);
    await page.locator("#program-slug").fill(`e2e-program-${stamp}`);
    await page.getByRole("button", { name: a.action.create }).first().click();
    // The new program is listed (and offered in the course form's program picker): check its link.
    await expect(page.getByRole("link", { name: `E2E program ${stamp}` }).first()).toBeVisible();
    const audit = await page.request.get("/api/admin/academy/audit?action=program.create");
    expect(audit.status()).toBe(200);
    expect(await audit.text()).toContain("program.create");
  });

  test("policies resolve academy, program and course levels only", async ({ page }) => {
    skipUnless("E2E_ADMIN_STATE");
    const response = await page.request.get("/api/admin/academy/policies");
    expect(response.status()).toBe(200);
    expect(await response.text()).not.toMatch(/class_group|CLASS_GROUP/);
  });

  test("teacher management: the review queue and the teacher directory, private and not stored", async ({ page }) => {
    skipUnless("E2E_ADMIN_STATE");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/academy/manage/teachers");
    await expect(page.getByRole("heading", { name: a.teachers.title })).toBeVisible();
    await expect(page.locator("#teacher-application-state")).toHaveValue("awaiting");
    await expectNoHorizontalScroll(page);
    const queue = await page.request.get("/api/admin/academy/teacher-applications?state=awaiting");
    expect(queue.status()).toBe(200);
    expect(queue.headers()["cache-control"]).toMatch(/no-store/);
    expect(await queue.text()).not.toMatch(/teacher-signup\/(cv|videos)\//);
    const picker = await page.request.get("/api/admin/academy/teachers?activeOnly=true");
    expect(picker.status()).toBe(200);
    for (const teacher of (await picker.json()).data) expect(teacher.status).toBe("active");
  });
});

// The six-account run: Teacher B and Student B belong to a second class group
// (E2E_OTHER_CLASS_GROUP_ID); the pending teacher's application is under
// review. Expected outcomes are pinned in tests/academy/cross-role-scenario.test.ts.
test.describe("pending teacher", () => {
  test.use({ storageState: env.E2E_PENDING_TEACHER_STATE || undefined });

  test("is taken to the application page and holds no teaching access", async ({ page }) => {
    skipUnless("E2E_PENDING_TEACHER_STATE");
    await page.goto("/academy/teach");
    await expect(page).toHaveURL(/\/academy\/teacher-application$/);
    await expect(page.getByRole("heading", { name: t.application.title })).toBeVisible();
    for (const path of ["/api/academy/me/teaching", "/api/academy/messages/threads"]) {
      expect((await page.request.get(path)).status()).toBe(403);
    }
    await page.goto("/dashboard/teacher");
    await expect(page).toHaveURL(/\/academy\/teacher-application$/);
  });
});

test.describe("teacher of another class group", () => {
  test.use({ storageState: env.E2E_TEACHER_B_STATE || undefined });

  test("cannot open Teacher A's class group, roster or attendance", async ({ page }) => {
    skipUnless("E2E_TEACHER_B_STATE", "E2E_CLASS_GROUP_ID", "E2E_SESSION_ID");
    for (const path of [`/api/academy/class-groups/${env.E2E_CLASS_GROUP_ID}`, `/api/academy/class-groups/${env.E2E_CLASS_GROUP_ID}/roster`, `/api/academy/sessions/${env.E2E_SESSION_ID}/attendance`]) {
      expect((await page.request.get(path)).status()).toBe(403);
    }
    await page.goto(`/academy/class-groups/${env.E2E_CLASS_GROUP_ID}`);
    await expect(page.getByText(t.states.forbidden)).toBeVisible();
  });
});

test.describe("learner of another class group", () => {
  test.use({ storageState: env.E2E_STUDENT_B_STATE || undefined });

  test("cannot open class group A or its Lesson Sheets", async ({ page }) => {
    skipUnless("E2E_STUDENT_B_STATE", "E2E_CLASS_GROUP_ID", "E2E_RELEASED_LESSON_ID");
    for (const path of [`/api/academy/class-groups/${env.E2E_CLASS_GROUP_ID}`, `/api/academy/class-groups/${env.E2E_CLASS_GROUP_ID}/lesson-sheets/${env.E2E_RELEASED_LESSON_ID}`]) {
      expect((await page.request.get(path)).status()).toBe(403);
    }
  });
});
