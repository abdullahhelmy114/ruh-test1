import { redirect } from "next/navigation";

// Retired: Legacy student list; class rosters are in each class group.
// Teaching happens in the academy workspace (/academy/teach: classes, sessions,
// preparation, attendance, grading, feedback, messages). /dashboard sends each
// account to its own home, so an applicant reaches their application page and
// nobody lands on a screen for another role.
export default function LegacyTeacherStudentsPage() {
  redirect("/dashboard");
}
