import { redirect } from "next/navigation";
import { LEARNER_HOME } from "@/lib/auth/home";

// Retired: part of the legacy course player (practice games generated from the
// legacy `lessons` and `generated_games` tables, which are not part of the academy
// schema). Practice and remediation are in the academy learner workspace.
export default function LegacyStudentCoursePracticePage() {
  redirect(LEARNER_HOME);
}
