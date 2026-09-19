import { redirect } from "next/navigation";

// Retired: the bundles page listed three hard-coded bundles with invented prices
// and discounts. Bundles are not part of the academy model; places are bought per
// class group on each course's page in the academy catalog.
export default function LegacyBundlesPage() {
  redirect("/academy");
}
