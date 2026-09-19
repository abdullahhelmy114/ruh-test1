import { redirect } from "next/navigation";

// Retired: the cart read a `cart_items` table that is not part of the academy
// schema. There is no cart: a place in a class group is bought directly from the
// course's page in the academy catalog, through Whop.
export default function LegacyCartPage() {
  redirect("/academy");
}
