import { redirect } from "next/navigation";
import { ADMIN_HOME } from "@/lib/auth/home";

// Retired: the legacy administration dashboard opened on an overview that read
// the `course`, `transactions` and `payouts` tables, and its other tabs read more
// tables outside the academy schema (bundles, coupons, gamification, legacy
// courses and lessons). Administration happens in the academy: programs,
// courses, class groups, teachers, production, policies and audit.
export default function LegacyAdminDashboardPage() {
  redirect(ADMIN_HOME);
}
