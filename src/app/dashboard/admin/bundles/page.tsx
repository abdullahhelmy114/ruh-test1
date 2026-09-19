import { redirect } from "next/navigation";

// Retired: bundle administration wrote a `bundles` table that is not part of the
// academy schema. Courses, class groups and their Whop offers are managed in the
// academy administration.
export default function LegacyAdminBundlesPage() {
  redirect("/academy/manage");
}
