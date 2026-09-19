import { redirect } from "next/navigation";
import { LEARNER_HOME } from "@/lib/auth/home";

// Retired: part of the legacy course player, whose course, points and progress
// tables are not part of the academy schema. See the academy learner workspace.
export default function LegacyStudentCoursePointsPage() {
  redirect(LEARNER_HOME);
}
