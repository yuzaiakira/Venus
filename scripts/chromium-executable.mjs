import { existsSync } from "node:fs";

// Browser acceptance must use the Chromium revision installed for this exact
// Playwright version. System Chrome may ignore unpacked-extension flags when
// Playwright launches it, which would test Google's New Tab page instead of
// Venus.
export function chromiumExecutable(chromium) {
  const executablePath = chromium.executablePath();
  return existsSync(executablePath) ? executablePath : undefined;
}
