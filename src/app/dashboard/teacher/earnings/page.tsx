import { redirect } from "next/navigation";

// Retired: Legacy earnings from the removed payment flows; teacher payouts are not part of the academy and stay disabled.
// Teaching happens in the academy workspace (/academy/teach: classes, sessions,
// preparation, attendance, grading, feedback, messages). /dashboard sends each
// account to its own home, so an applicant reaches their application page and
// nobody lands on a screen for another role.
export default function LegacyTeacherEarningsPage() {
  redirect("/dashboard");
}
