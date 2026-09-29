import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "a2-1-create.e2e.spec.ts",
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  reporter: "line",
});
