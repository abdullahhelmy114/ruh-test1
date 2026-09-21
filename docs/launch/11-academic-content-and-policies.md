# 11 — Academic content and policies

Revision under review: **fe50526** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
Nothing here publishes content, sets a policy or changes the product model.

## A. The twelve policies

**FACT** — `src/lib/academy/policies/registry.ts` defines **12** policies. **None has a default**, and
no migration seeds `academy_policy_values`. A service that needs an unset policy fails closed with
`POLICY_UNCONFIGURED` — "This academy setting has not been configured yet."
(`src/lib/academy/policies/resolver.ts:158`).

**Correction:** `docs/audits/2026-09-21-unavailable-features.md` says 13. The authoritative count,
taken from the module, is **12**. The conclusion there is unchanged.

Values live in `academy_policy_values`, one row per (key, level), resolved most-specific-first:
class group → course → program → academy. An administrator sets them at
`/academy/manage/policies` (`PATCH /api/admin/academy/policies/[key]` with a scope, a value, a
reason and the expected revision).

**Every proposed value below is a PROPOSAL and needs Dr. Jihan's approval.** The engineer must not
choose them: they are academic rules, not configuration defaults.

| # | Policy | What it governs | If unset | Proposed initial value | Owner approval |
| --- | --- | --- | --- | --- | --- |
| 1 | `institution.timezone` | The academy's single clock; the local calendar week the Lesson Sheet release rule is measured in | **Lesson sheets unavailable**; times render without a zone | An IANA zone name, e.g. `"Africa/Cairo"` — Dr. Jihan's teaching zone | **yes** |
| 2 | `attendance.vocabulary` | The marks a teacher may record, with labels in en/ar/tr and whether each counts as attended | Attendance cannot be recorded | present / absent / late / excused, with `countsAsAttended` true for present and late | **yes** |
| 3 | `attendance.requirement` | A minimum attended ratio | Nothing reads it today | Decide whether to keep the key at all (see "unconsumed" below) | **yes** |
| 4 | `learning.late_work` | Whether late submissions are accepted, and how late | **A learner cannot start or submit an attempt** | accept late work, 72 hours, marked late | **yes** |
| 5 | `learning.revision` | Resubmission after a teacher returns work | Starting an attempt and returning one both fail | one revision allowed | **yes** |
| 6 | `assessment.attempt_limit` | Attempts per assessment | Starting any attempt fails | 1 at academy scope, overridden per course where practice deserves more | **yes** |
| 7 | `assessment.result_release` | When a learner sees a result | Submitting and grading both fail | `after_teacher_review` — the only mode that never shows an ungraded result | **yes** |
| 8 | `assessment.requirements` | Required assessment modes | Nothing reads it today | Decide whether to keep the key (see below) | **yes** |
| 9 | `completion.criteria` | When a learner has completed a course | Completion cannot be evaluated | Shape agreed first, numbers by Dr. Jihan | **yes** |
| 10 | `certificate.eligibility` | Who may receive a certificate | Eligibility and issuing both fail | Start with certificates **off** until the certificate text is approved | **yes** |
| 11 | `recordings.access` | Learner access to session recordings | A learner listing or opening a recording fails; staff unaffected | enrolled learners, limited window, no download | **yes** |
| 12 | `communications.messaging` | Learner ↔ teacher direct messages | Opening a learner/teacher conversation fails; admin conversations unaffected | both directions allowed | **yes** |

**Two keys are never read** (`attendance.requirement`, `assessment.requirements`).
**OWNER DECISION REQUIRED:** either remove them so the administrator's checklist is honest, or name
what they are meant to gate. Until then an administrator must set twelve values, two of which do
nothing. Removing a key is a code change and is **not** made here.

### Setup order, with a check after each step

Set at academy scope unless stated. After each, re-run `node scripts/launch-readiness-check.mjs`
and confirm the policy moves from the unset list.

1. `institution.timezone` → open a class group's Lesson Sheets tab: a sheet shows a release date
   instead of "not available yet".
2. `attendance.vocabulary` → open a session's attendance register: the marks appear.
3. `learning.late_work`, `learning.revision`, `assessment.attempt_limit`,
   `assessment.result_release` → a learner can start, submit, and a teacher can grade and return.
4. `completion.criteria`, `certificate.eligibility` → completion evaluates; certificates stay off
   until approved.
5. `recordings.access` → a learner sees a recording if one exists.
6. `communications.messaging` → a learner can open a conversation with their teacher.

## B. Minimum approved content for a controlled launch

**This is a prerequisite checklist, not permission to publish.** No academic material is created,
drafted or published by this work, and none may be invented.

| # | Prerequisite | Where | Evidence of PASS | Approval |
| --- | --- | --- | --- | --- |
| 1 | One approved **program** | `/academy/manage/catalog` | It appears on `/academy` | **yes** — Dr. Jihan |
| 2 | One approved **course** under it | same | Its public page renders | **yes** |
| 3 | One **curriculum version** with its lessons | `/academy/manage/curriculum-versions/[id]` | The outline lists lessons | **yes** |
| 4 | Canonical **Lesson Sheets** for those lessons | production/authoring | A sheet opens inside its release window | **yes** (religious/academic review) |
| 5 | One **class group**, pinned to that curriculum version | `/academy/manage/class-groups` | It appears with its dates | **yes** |
| 6 | An **approved teacher assigned** to it | same | The teacher sees it on `/academy/teach` | **yes** |
| 7 | **Sessions** scheduled, each with its meeting link | class group → sessions | A session shows its time in the academy's zone | **yes** |
| 8 | An **offer** linked to that class group | `/academy/manage` commerce | The Buy button appears on the course page | **yes** + finance (report 09) |
| 9 | At least one **enrolled learner** (administrator-enrolled is fine for a controlled launch) | class group → roster | The learner sees the class on `/academy/learn` | **yes** |

The readiness check reports 1, 2, 3, 5, 7, 8 and the teacher assignment as content gates, so the
state can be confirmed without opening the database.

## C. The production sequence is preserved

Curricula → Lessons → Activities → Stories/Adventures → Media → Gamification/Games →
Tests/Assessments → Remedial Plans → Results/Reports. Nothing in this work reorders it, and the
locked distinctions (Course vs Class Group, Lesson vs Session, one Curriculum Version per Class
Group, teachers never editing canonical published content, the server-side one-week Lesson Sheet
window, private notes separate from submitted work) are unchanged and still enforced in code.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
