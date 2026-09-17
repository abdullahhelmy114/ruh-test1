import { redirect } from "next/navigation";

// Retired: Legacy model-course marketplace (applying to teach a model course).
// Teaching happens in the academy workspace (/academy/teach: classes, sessions,
// preparation, attendance, grading, feedback, messages). /dashboard sends each
// account to its own home, so an applicant reaches their application page and
// nobody lands on a screen for another role.
export default function LegacyAvailableCoursesPage() {
  redirect("/dashboard");
}
