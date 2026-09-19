import { redirect } from "next/navigation";

// Retired: the legacy course list read the `course` and `categories` tables, which
// are not part of the academy schema. The academy catalog is the one public list
// of programs and courses.
export default function LegacyCoursesPage() {
  redirect("/academy");
}
