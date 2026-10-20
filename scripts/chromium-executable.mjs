import { existsSync } from "node:fs";

// Prefer the browser installed by `npm run setup:browsers`. It is isolated in
// the workspace and has the sandbox layout expected by Playwright. A caller
// can still select a reviewed system binary with CHROME_BIN.
export function chromiumExecutable(chromium) {
  const candidates = [
    process.env.CHROME_BIN,
    chromium.executablePath(),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((path) => typeof path === "string" && path.length > 0);
  return candidates.find((path) => existsSync(path));
}
