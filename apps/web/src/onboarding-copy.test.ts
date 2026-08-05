/**
 * Structural check: main shell onboarding strings ship in App.tsx source.
 * Ensures the UI self-explains without requiring README for first steps.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "App.tsx"),
  "utf8",
);

describe("main page onboarding copy", () => {
  it("explains product purpose and ordered get-started steps", () => {
    expect(appSrc).toMatch(/Get started/);
    expect(appSrc).toMatch(/Start the server/);
    expect(appSrc).toMatch(/Confirm server health/);
    expect(appSrc).toMatch(/Paste your app token/);
    expect(appSrc).toMatch(/Pick a tab/);
    expect(appSrc).toMatch(/story lore|NovelAI/);
  });

  it("explains app token purpose, source, storage, and lock semantics", () => {
    expect(appSrc).toMatch(/app token/i);
    expect(appSrc).toMatch(/pnpm auth:show/);
    expect(appSrc).toMatch(/localStorage/);
    expect(appSrc).toMatch(/Token saved in this browser|No token saved yet/);
    expect(appSrc).toMatch(/Features locked|tabs stay locked|Feature tabs are locked/);
    expect(appSrc).toMatch(/setStoredToken|getStoredToken/);
  });

  it("distinguishes health up vs down with remediation", () => {
    expect(appSrc).toMatch(/API reachable/);
    expect(appSrc).toMatch(/API not reachable/);
    expect(appSrc).toMatch(/run-dev\.sh|pnpm start/);
    expect(appSrc).toMatch(/fetchHealth/);
  });

  it("includes short per-tab purpose blurbs", () => {
    expect(appSrc).toMatch(/Characters/);
    expect(appSrc).toMatch(/Settings/);
    expect(appSrc).toMatch(/Scaffold/);
    expect(appSrc).toMatch(/Gallery/);
    expect(appSrc).toMatch(/TAB_HELP/);
    expect(appSrc).toMatch(/memory, lorebook/);
    expect(appSrc).toMatch(/image vault|durable vault|Generate/);
  });
});
