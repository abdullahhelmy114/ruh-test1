import type { Metadata } from "next";
import { NotFoundView } from "@/components/site/not-found-view";

/**
 * The site's 404, for addresses that match no route and for notFound() calls.
 *
 * An earlier version returned its own <html> and <body>, which took it outside
 * the root layout: the document arrived with no lang or dir and the text was
 * Arabic whoever was reading. Rendering only the body keeps it inside the
 * layout, which sets both from the same preference cookie every page uses.
 *
 * One caveat, checked against Next 16.3.1 and not caused by this file: a
 * notFound() call inside a route (an unknown program, course or certificate)
 * is recovered at the top of the render, and the server sends Next's own
 * `<html id="__next_error__">` document with the real tree in the RSC payload.
 * The reader still gets this page, in their language, inside the site shell,
 * because the client renders that payload — but the served HTML carries no
 * lang or dir. A minimal page whose whole body is notFound() behaves the same
 * way, so there is nothing here to fix; the response is a 404 and carries
 * noindex either way. The only lever Next offers is the experimental
 * global-not-found convention, which replaces the document for unmatched
 * addresses too and would lose the layout they render correctly today.
 */
export const metadata: Metadata = {
  // A missing page must not be indexed, whichever address produced it.
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundView />;
}
