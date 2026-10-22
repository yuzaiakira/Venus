import { defineConfig } from "wxt";
import { resolve } from "node:path";
function channelFor(browser: string) {
  const channel =
    browser === "firefox"
      ? (process.env.VENUS_FIREFOX_CHANNEL ?? "p00")
      : "p00";
  if (!["p00", "beta", "release"].includes(channel))
    throw new Error("Invalid VENUS_FIREFOX_CHANNEL");
  return channel;
}
export default defineConfig({
  hooks: {
    "config:resolved": (wxt) => {
      if (process.env.VENUS_PLUGIN_FAULT_OUT === "1") {
        wxt.config.outDir = resolve(
          wxt.config.root,
          ".output-p04-fault",
          `${wxt.config.browser}-mv3`,
        );
      }
      const channel = channelFor(wxt.config.browser);
      if (channel !== "p00") {
        if (
          wxt.config.command !== "build" ||
          wxt.config.mode !== "production" ||
          wxt.config.manifestVersion !== 3
        )
          throw new Error("Beta/release requires a production MV3 build");
        wxt.config.outBaseDir = resolve(wxt.config.root, `.output-${channel}`);
        wxt.config.outDir = resolve(wxt.config.outBaseDir, "firefox-mv3");
      }
    },
  },
  modules: ["@wxt-dev/module-react"],
  manifest: ({ browser, manifestVersion }) => {
    const channel = channelFor(browser);
    const permanent = channel !== "p00";
    return {
      name:
        browser === "firefox" && permanent
          ? `Venus Workspace — ${channel === "beta" ? "Beta" : "Release"} Technical Preview`
          : "Venus Workspace — P00",
      description:
        browser === "firefox" && permanent
          ? "Local-only P00 technical preview: Home/New Tab shell and storage, alarm, permission probes; no full workspace features. Firefox requests Home replacement."
          : "Local-only feasibility build. Firefox installation requests browser-managed Home replacement.",
      permissions: ["storage", "alarms"],
      optional_permissions: ["bookmarks", "notifications"],
      optional_host_permissions: [
        "https://customer-api.open-meteo.com/*",
        "https://geocoding-api.open-meteo.com/*",
      ],
      icons: { 48: "icons/icon-48.png", 96: "icons/icon.png" },
      ...(browser === "firefox"
        ? {
            chrome_settings_overrides: { homepage: "newtab.html" },
            browser_specific_settings: {
              gecko: {
                id: permanent
                  ? "{935006c2-63b4-4e03-b842-11b88571da3b}"
                  : "p00@Venus.invalid",
                strict_min_version: "140.0",
                data_collection_permissions: { required: ["none"] },
              },
            },
          }
        : {}),
      content_security_policy:
        manifestVersion === 2
          ? "script-src 'self'; object-src 'none'"
          : { extension_pages: "script-src 'self'; object-src 'none'" },
    };
  },
});
