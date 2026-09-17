// The site shell at the widths real readers use, and the 404 document.
//
// Two defects found by browser validation on 2026-09-17 are pinned here. The
// header switched to its desktop row at 768px although that row needs about
// 1100px, so between 768px and roughly 1100px controls were pushed off the
// left edge and could not be clicked. And the 404 page rendered its own
// <html>, which put it outside the root layout: the document arrived with no
// lang or dir and always in Arabic.
//
// The 404 checks below read the live document, which is what a reader sees.
// For a notFound() call Next 16.3.1 sends its own recovery document and the
// client renders the real tree into it, so the served HTML has no lang or dir
// even though the page does; src/app/not-found.tsx explains why.
//
// These need only a running build (no database, no accounts).
import { PUBLIC_MESSAGES } from "../../../src/lib/academy/public/messages.ts";
import { expect, expectNoHorizontalScroll, test, useLocale } from "./fixtures.mjs";

const WIDTHS = [390, 768, 900, 1280];
const SHELL_PAGES = ["/", "/academy", "/signup/teacher"];
const UNKNOWN_PAGES = ["/academy/programs/no-such-program-xyz", "/academy/courses/no-such-course-xyz"];

/** Header controls that a reader can see and click: none may sit outside the viewport. */
async function headerControlsInView(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return { found: false, outside: [] };
    const outside = [...header.querySelectorAll("a, button")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40));
    return { found: true, outside };
  });
}

for (const locale of ["en", "ar"]) {
  test.describe(`site shell (${locale})`, () => {
    test.beforeEach(async ({ page, baseURL }) => useLocale(page, baseURL, locale));

    for (const width of WIDTHS) {
      test(`header controls stay inside the viewport at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        for (const path of SHELL_PAGES) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          const header = await headerControlsInView(page);
          expect(header.found, `${path}: the shell renders a header`).toBe(true);
          expect(header.outside, `${path} at ${width}px`).toEqual([]);
          await expectNoHorizontalScroll(page);
        }
      });

      test(`the main navigation can be reached at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");
        const desktopNav = page.locator("header nav").first();
        if (await desktopNav.isVisible()) {
          await expect(desktopNav.getByRole("link").first()).toBeVisible();
        } else {
          // The compact shell keeps the same destinations behind the menu button.
          const menu = page.getByRole("button", { name: /open menu|close menu/i });
          await expect(menu).toBeVisible();
          await menu.focus();
          // Keyboard users must be able to see where they are.
          const focusRing = await page.evaluate(() => {
            const el = document.activeElement;
            const style = getComputedStyle(el, ":focus-visible");
            return { tag: el?.tagName, outline: style.outlineStyle, width: style.outlineWidth, shadow: style.boxShadow };
          });
          expect(focusRing.tag).toBe("BUTTON");
          await menu.click();
          await expect(page.getByRole("link", { name: /.+/ }).first()).toBeVisible();
        }
      });
    }
  });

  test.describe(`unknown addresses (${locale})`, () => {
    test.beforeEach(async ({ page, baseURL }) => useLocale(page, baseURL, locale));

    test("a missing page is a localized 404 that search engines are told to skip", async ({ page }) => {
      const t = PUBLIC_MESSAGES[locale];
      for (const path of UNKNOWN_PAGES) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(404);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.getByText(t.pageNotFoundTitle)).toBeVisible();
        await expect(page.getByRole("link", { name: t.backToHome })).toBeVisible();
        expect(await page.locator('meta[name="robots"]').first().getAttribute("content"), path).toContain("noindex");
        await expectNoHorizontalScroll(page);
      }
    });
  });
}
