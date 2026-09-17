import { redirect } from "next/navigation";

// Retired: The legacy teacher home (live courses, revenue and a fixed 20% commission figure, links to pages that do not exist).
// Teaching happens in the academy workspace (/academy/teach: classes, sessions,
// preparation, attendance, grading, feedback, messages). /dashboard sends each
// account to its own home, so an applicant reaches their application page and
// nobody lands on a screen for another role.
export default function LegacyTeacherDashboardPage() {
  redirect("/dashboard");
}
