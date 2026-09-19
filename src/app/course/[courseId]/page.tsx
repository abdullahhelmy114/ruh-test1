import { redirect } from "next/navigation";

// Retired: the legacy course page read the `course`, `categories` and `reviews`
// tables, which are not part of the academy schema, and its ids do not name
// academy courses. Every course is in the academy catalog, each with its own page.
export default function LegacyCoursePage() {
  redirect("/academy");
}
