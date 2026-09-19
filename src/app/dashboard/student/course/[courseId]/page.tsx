import { redirect } from "next/navigation";
import { LEARNER_HOME } from "@/lib/auth/home";

// Retired: the legacy course player read `enrollments`, `course`, `lessons`,
// `lesson_completions`, `quizzes` and `exam_questions`, which are not part of the
// academy schema. Lessons, lesson sheets and assessments are in the academy
// learner workspace.
export default function LegacyStudentCoursePage() {
  redirect(LEARNER_HOME);
}
