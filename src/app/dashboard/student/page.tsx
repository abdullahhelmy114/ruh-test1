import { redirect } from "next/navigation";
import { LEARNER_HOME } from "@/lib/auth/home";

// Retired: the legacy student home read points, streaks, enrollments, courses,
// lessons and live sessions from tables that are not part of the academy schema
// (`live_course`, `enrollments`, `course`, `lessons`, ...). A learner's classes,
// sessions, assignments and certificates are in the academy learner workspace.
export default function LegacyStudentDashboardPage() {
  redirect(LEARNER_HOME);
}
