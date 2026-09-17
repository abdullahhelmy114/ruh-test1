import { redirect } from "next/navigation";

// Retired: Legacy student contact lists for marketing.
// Teaching happens in the academy workspace (/academy/teach: classes, sessions,
// preparation, attendance, grading, feedback, messages). /dashboard sends each
// account to its own home, so an applicant reaches their application page and
// nobody lands on a screen for another role.
export default function LegacyTeacherMarketingPage() {
  redirect("/dashboard");
}
