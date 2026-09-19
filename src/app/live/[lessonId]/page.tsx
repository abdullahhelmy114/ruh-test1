import { redirect } from "next/navigation";

// Retired: the legacy live-lesson room loaded its meeting through the legacy
// `lessons` and `enrollments` tables, which are not part of the academy schema.
// Sessions and their meeting links are in the academy workspace; /dashboard
// sends each account to its own academy home (learners and teachers alike).
export default function LegacyLiveLessonPage() {
  redirect("/dashboard");
}
