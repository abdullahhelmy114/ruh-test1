import { redirect } from "next/navigation";

// Retired: the wishlist read a `wishlist` table that is not part of the academy
// schema and saved legacy course ids. Courses are browsed in the academy catalog.
export default function LegacyWishlistPage() {
  redirect("/academy");
}
