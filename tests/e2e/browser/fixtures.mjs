// Shared browser fixtures: every page is confined to the site under test.
// Requests to any other host are aborted unless the host is listed in
// E2E_ALLOWED_HOSTS (comma separated), which authenticated runs need for the
// approved non-production Firebase project. Nothing else leaves the machine.
import { test as base, expect } from "@playwright/test";

const allowed = new Set(
  (process.env.E2E_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
);

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const siteHost = new URL(baseURL ?? "http://localhost:3100").hostname;
    const external = [];
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === "data:" || url.protocol === "blob:" || url.hostname === siteHost || allowed.has(url.hostname)) return route.continue();
      external.push(url.hostname);
      return route.abort();
    });
    await use(page);
    // Blocking is the guarantee; the list only helps explain a failing page.
    if (external.length > 0) test.info().annotations.push({ type: "blocked-hosts", description: [...new Set(external)].join(", ") });
  },
});

export { expect };

/** Sets the reader's language through the site's existing preference cookie. */
export async function useLocale(page, baseURL, locale) {
  await page.context().addCookies([{ name: "preferred-locale", value: locale, url: baseURL }]);
}

/** The page does not scroll sideways (a 1px rounding allowance). */
export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
