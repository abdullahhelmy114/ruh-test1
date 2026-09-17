// Browser end-to-end configuration. See tests/e2e/README.md for how to run
// these specs and what each group needs. @playwright/test is not a project
// dependency yet; install it (and a browser) in the environment that runs
// the browser suite.
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./browser",
  testMatch: /.*\.spec\.mjs$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Learner screens must work on a phone, administration forms from tablet width, authoring from 1024px.
    { name: "phone-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
