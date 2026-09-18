// Public academy and signed-out workspace flows. These need only a running
// build (no database, no accounts). The same flows were executed against a
// local production build through a Playwright-driven browser on 2026-09-17
// (see tests/e2e/README.md).
import { PUBLIC_MESSAGES } from "../../../src/lib/academy/public/messages.ts";
import { WORKSPACE_MESSAGES } from "../../../src/lib/academy/workspace/messages.ts";
import { expect, expectNoHorizontalScroll, test, useLocale } from "./fixtures.mjs";

const PUBLIC_PAGES = ["/academy", "/academy/programs/arabic-foundations", "/academy/courses/nahw-1"];
const WORKSPACE_PAGES = ["/academy/learn", "/academy/teach", "/academy/manage", "/academy/class-groups/00000000-0000-4000-8000-000000000001"];

async function academyReady(request) {
  const response = await request.get("/api/public/academy/catalog");
  return response.status() === 200;
}

for (const locale of ["en", "ar", "tr"]) {
  test.describe(`public academy (${locale})`, () => {
    test.beforeEach(async ({ page, baseURL }) => useLocale(page, baseURL, locale));

    test("catalog, program and course pages render in the reader's language and direction", async ({ page, request }) => {
      const ready = await academyReady(request);
      for (const path of PUBLIC_PAGES) {
        const response = await page.goto(path);
        expect([200, 404]).toContain(response?.status());
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        if (!ready) await expect(page.getByText(PUBLIC_MESSAGES[locale].notAvailable)).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
    });

    test("certificate verification is a plain form that reports its outcome to screen readers", async ({ page }) => {
      const t = PUBLIC_MESSAGES[locale];
      await page.goto("/academy/certificates/verify");
      await page.getByLabel(t.verifyLabel).fill("RQ-AAAA-BBBB-CCCC");
      await Promise.all([page.waitForURL(/code=RQ-AAAA-BBBB-CCCC/), page.getByRole("button", { name: t.verifyButton }).click()]);
      const outcome = page.locator('div[aria-live="polite"]');
      await expect(outcome).toContainText(new RegExp([t.notAvailable, t.verifyNotFound, t.verifyTooMany, t.verifyValid, t.verifyRevoked].map(escape).join("|")));
      await expectNoHorizontalScroll(page);
    });
  });

  test.describe(`signed-out workspace (${locale})`, () => {
    test.beforeEach(async ({ page, baseURL }) => useLocale(page, baseURL, locale));

    test("every entry screen asks the visitor to sign in and shows no data", async ({ page }) => {
      const t = WORKSPACE_MESSAGES[locale];
      for (const path of WORKSPACE_PAGES) {
        await page.goto(path);
        await expect(page.getByText(t.states.signInRequired)).toBeVisible({ timeout: 20_000 });
        await expect(page.locator('#workspace-main a[href="/login"]')).toHaveCount(1);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
        await expectNoHorizontalScroll(page);
      }
    });
  });
}

test("the skip link moves keyboard focus to the workspace content", async ({ page }) => {
  await page.goto("/academy/learn");
  await expect(page.getByText(WORKSPACE_MESSAGES.en.states.signInRequired)).toBeVisible({ timeout: 20_000 });
  const skip = page.getByRole("link", { name: WORKSPACE_MESSAGES.en.nav.skip });
  await skip.focus();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
  await expect(page.locator('nav a[aria-current="page"]')).toHaveText(WORKSPACE_MESSAGES.en.nav.learn);
});

test("dark mode switches the workspace colours through theme tokens", async ({ page }) => {
  // Follow the reader's system setting, as the site does; toggling the class by hand raced the theme
  // provider, which sets it again once it hydrates.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/academy/learn");
  const colours = () => page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }));
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  const light = await colours();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  const dark = await colours();
  expect(dark.bg).not.toBe(light.bg);
  expect(dark.fg).not.toBe(light.fg);
});

test("the site navigation leads to the academy on desktop and phone", async ({ page }) => {
  await page.goto("/");
  // The desktop row starts at 1280px (the header's xl breakpoint); narrower windows use the menu button.
  if ((page.viewportSize()?.width ?? 1280) < 1280) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator('a[href="/academy"]').first()).toBeVisible();
  } else {
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: "Academy" })).toHaveAttribute("href", "/academy");
  }
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
