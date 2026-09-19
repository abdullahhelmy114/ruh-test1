import { redirect } from "next/navigation";
import { LEARNER_HOME } from "@/lib/auth/home";

// Retired: the legacy course exam read `enrollments`, `exam_questions` and
// `exam_attempts`, which are not part of the academy schema. Assessments are
// assigned and taken in the academy learner workspace.
export default function LegacyStudentExamPage() {
  redirect(LEARNER_HOME);
}
