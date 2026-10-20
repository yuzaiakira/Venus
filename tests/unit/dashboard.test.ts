import { describe, expect, it } from "vitest";
import { WidgetBoundary } from "../../src/app/widgets";
import {
  filterCommands,
  onboardingContinues,
  permissionNoteKey,
} from "../../src/domain/commands";
import {
  contrastRatio,
  defaultBootstrap,
  formatClock,
  glassSolid,
  layoutFor,
  paletteShortcutAllowed,
  reflow,
  storedFit,
  themeTokens,
  validateAccent,
  validateAsset,
  weekLabels,
} from "../../src/domain/dashboard";
import { en, fa } from "../../src/locales/messages";

describe("P01 dashboard foundation", () => {
  it("keeps fa and en catalogs aligned", () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });
  it("formats Jalali with Persian digits independently of Latin numerals", () => {
    const prefs = defaultBootstrap("Asia/Tehran");
    prefs.locale = "fa";
    prefs.numeralSystem = "persian";
    prefs.calendarDisplay = "jalali";
    const clock = formatClock(new Date("2026-03-21T12:00:00Z"), prefs);
    expect(clock.dates[0]).toContain("فروردین");
    expect(clock.dates[0]).toMatch(/[۰-۹]/);
    prefs.numeralSystem = "latin";
    const latin = formatClock(new Date("2026-03-21T12:00:00Z"), prefs);
    expect(latin.dates[0]).toContain("فروردین");
    expect(latin.dates[0]).not.toMatch(/[۰-۹]/);
  });
  it("starts the week on Saturday when that preference is set", () => {
    const prefs = defaultBootstrap("UTC");
    prefs.locale = "en";
    prefs.weekStart = 6;
    expect(weekLabels(prefs)[0]).toMatch(/Sat/i);
  });
  it("meets contrast floors for both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(
        contrastRatio(themeTokens[theme].text, themeTokens[theme].canvas),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(themeTokens[theme].text, glassSolid(theme, 0.65)),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("rejects a low-contrast accent and an oversized image", () => {
    expect(() => validateAccent("#111827", "dark")).toThrow("invalidInput");
    expect(() =>
      validateAsset({
        mime: "image/png",
        byteLength: 10,
        width: 4000,
        height: 4000,
      }),
    ).toThrow("invalidInput");
    expect(
      validateAsset({
        mime: "image/png",
        byteLength: 10,
        width: 10,
        height: 10,
      }).mime,
    ).toBe("image/png");
  });
  it("reflows a wide layout onto one column without overlap", () => {
    const items = layoutFor("productivity").map((item, index) => ({
      ...item,
      id: String(index),
    }));
    const narrow = reflow(items, 1);
    expect(storedFit(items)).toBe(true);
    for (const item of narrow) expect(item.x + item.w).toBeLessThanOrEqual(1);
    for (let i = 0; i < narrow.length; i += 1) {
      for (let j = i + 1; j < narrow.length; j += 1) {
        const a = narrow[i];
        const b = narrow[j];
        if (!a || !b) continue;
        const overlap =
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y;
        expect(overlap).toBe(false);
      }
    }
  });
  it("keeps the command shortcut out of inputs and continues after permission denial", () => {
    expect(paletteShortcutAllowed("INPUT", false)).toBe(false);
    expect(paletteShortcutAllowed("DIV", true)).toBe(false);
    expect(paletteShortcutAllowed("DIV", false)).toBe(true);
    expect(onboardingContinues(false)).toBe(true);
    expect(permissionNoteKey("denied")).toBe("onboarding.denied");
    expect(permissionNoteKey("granted")).toBe("onboarding.granted");
    expect(permissionNoteKey("dismissed")).toBe("onboarding.dismissed");
    expect(permissionNoteKey("failed")).toBe("onboarding.failed");
    expect(permissionNoteKey("unsupported")).toBe("onboarding.unsupported");
    expect(permissionNoteKey("unresolved")).toBe("onboarding.unresolved");
    const filtered = filterCommands(
      [
        {
          id: "settings",
          label: "Open settings",
          group: "local",
          available: true,
          profileId: "",
        },
        {
          id: "note",
          label: "New note",
          group: "unavailable",
          available: false,
          profileId: "",
        },
      ],
      "note",
    );
    expect(filtered.map((item) => item.id)).toEqual(["note"]);
  });
  it("recovers a widget fault without replacing the dashboard", () => {
    expect(WidgetBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });
});
