import { useEffect, useState } from "react";
import type { Workspace, WorkspaceSnapshot } from "../application/workspace";
import { appearanceOf } from "../application/workspace";
import {
  resolveTheme,
  validateAccent,
  validateAsset,
  webSearchUrl,
  type Bootstrap,
  widgetTypes,
} from "../domain/dashboard";
import { translate, type MessageKey } from "../locales/messages";
import { App } from "./App";
import { applyDocument, paintUploadedWallpaper } from "./document";

export function SettingsScreen(props: {
  workspace: Workspace;
  onHome?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState<
    "appearance" | "layout" | "modules" | "profile" | ""
  >("");
  const [title, setTitle] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void props.workspace.load().then((next) => {
        if (active) setSnapshot(next);
      });
    };
    refresh();
    const unsubscribe = props.workspace.subscribe(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [props.workspace]);
  useEffect(() => {
    if (!snapshot) return;
    const profile = snapshot.profiles.find(
      (item) => item.id === snapshot.bootstrap.selectedProfileId,
    );
    const appearance = appearanceOf(snapshot, profile);
    applyDocument({
      bootstrap: snapshot.bootstrap,
      themeMode: appearance.themeMode,
      wallpaper: appearance.wallpaper,
      blurPx: appearance.blurPx,
      glassAlpha: appearance.glassAlpha,
      accent: appearance.accent,
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    });
    if (appearance.wallpaper.kind !== "upload") return;
    let revoke = () => {};
    let active = true;
    void props.workspace
      .readAsset(appearance.wallpaper.assetId)
      .then((asset) => {
        if (!active || !asset) return;
        revoke = paintUploadedWallpaper(asset);
      });
    return () => {
      active = false;
      revoke();
    };
  }, [snapshot, props.workspace]);

  const locale = snapshot?.bootstrap.locale ?? "en";
  const t = (key: MessageKey) => translate(locale, key);
  const widgetLabel = (type: (typeof widgetTypes)[number]) =>
    t(
      {
        clock: "widget.clockTitle",
        search: "widget.searchTitle",
        bookmarks: "widget.linksTitle",
        upcoming: "widget.calendarTitle",
        today: "nav.tasks",
        timer: "widget.focusTitle",
        notes: "widget.notesTitle",
        briefing: "widget.briefingTitle",
        capture: "widget.captureTitle",
        habits: "widget.habitsTitle",
        goals: "widget.goalsTitle",
      }[type] as MessageKey,
    );
  if (!snapshot) {
    return (
      <main className="shell">
        <h1>{t("app.title")}</h1>
      </main>
    );
  }
  const profile = snapshot.profiles.find(
    (item) => item.id === snapshot.bootstrap.selectedProfileId,
  );
  const appearance = appearanceOf(snapshot, profile);
  const resolvedTheme = resolveTheme(
    appearance.themeMode,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const needle = query.trim().toLocaleLowerCase();
  const show = (label: string) =>
    !needle || label.toLocaleLowerCase().includes(needle);
  async function save(patch: Partial<Bootstrap>) {
    try {
      await props.workspace.updatePreferences(patch);
      setError("");
      setSaved(t("settings.saved"));
    } catch {
      setError(t("settings.error"));
    }
  }
  async function saveAppearance(
    patch: Partial<
      Pick<
        NonNullable<typeof profile>,
        "themeMode" | "wallpaper" | "blurPx" | "glassAlpha" | "accent"
      >
    >,
  ) {
    if (!profile) return;
    try {
      await props.workspace.patchProfileAppearance(
        profile.id,
        patch,
        resolvedTheme,
      );
      setError("");
      setSaved(t("settings.saved"));
    } catch {
      setError(t("settings.error"));
    }
  }

  return (
    <main className="settings-screen module">
      <header className="page-header">
        <h1>{t("nav.settings")}</h1>
        <a
          className="btn"
          href="newtab.html"
          onClick={(event) => {
            if (props.onHome) {
              event.preventDefault();
              props.onHome();
            }
          }}
        >
          {t("app.title")}
        </a>
      </header>
      <input
        className="field"
        placeholder={t("settings.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {saved ? <p className="success">{saved}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="settings-layout">
        <nav className="glass" aria-label={t("nav.settings")}>
          {(
            [
              "language",
              "appearance",
              "modules",
              "layout",
              "home",
              "platform",
            ] as const
          ).map((section) => (
            <a
              className="btn"
              key={section}
              href={`#venus-settings-${section}`}
            >
              {t(`settings.${section}`)}
            </a>
          ))}
        </nav>
        <div>
          {show(t("settings.language")) ? (
            <section className="glass" id="venus-settings-language">
              <h2>{t("settings.language")}</h2>
              <label>
                {t("settings.locale")}
                <select
                  className="select"
                  value={snapshot.bootstrap.locale}
                  onChange={(event) =>
                    void save({
                      locale: event.target.value === "fa" ? "fa" : "en",
                    })
                  }
                >
                  <option value="en">English</option>
                  <option value="fa">فارسی</option>
                </select>
              </label>
              <SearchProviderFields
                locale={locale}
                providerId={snapshot.bootstrap.searchProviderId}
                template={snapshot.bootstrap.customSearchTemplate}
                onSave={(patch) => void save(patch)}
                onInvalid={() => setError(t("search.invalid"))}
              />
              <label>
                {t("settings.numerals")}
                <select
                  className="select"
                  value={snapshot.bootstrap.numeralSystem}
                  onChange={(event) =>
                    void save({
                      numeralSystem:
                        event.target.value === "persian" ? "persian" : "latin",
                    })
                  }
                >
                  <option value="latin">{t("numerals.latin")}</option>
                  <option value="persian">{t("numerals.persian")}</option>
                </select>
              </label>
              <label>
                {t("settings.calendar")}
                <select
                  className="select"
                  value={snapshot.bootstrap.calendarDisplay}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "jalali" ||
                      value === "gregorian" ||
                      value === "both"
                    ) {
                      void save({ calendarDisplay: value });
                    }
                  }}
                >
                  <option value="gregorian">{t("calendar.gregorian")}</option>
                  <option value="jalali">{t("calendar.jalali")}</option>
                  <option value="both">{t("calendar.both")}</option>
                </select>
              </label>
              <label>
                {t("settings.hour")}
                <select
                  className="select"
                  value={snapshot.bootstrap.hourFormat}
                  onChange={(event) =>
                    void save({
                      hourFormat: event.target.value === "12" ? 12 : 24,
                    })
                  }
                >
                  <option value="24">24</option>
                  <option value="12">12</option>
                </select>
              </label>
              <label>
                {t("settings.week")}
                <select
                  className="select"
                  value={snapshot.bootstrap.weekStart}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (value === 0 || value === 1 || value === 6)
                      void save({ weekStart: value });
                  }}
                >
                  <option value="0">{t("week.sunday")}</option>
                  <option value="1">{t("week.monday")}</option>
                  <option value="6">{t("week.saturday")}</option>
                </select>
              </label>
              <TimeZoneField
                locale={locale}
                value={snapshot.bootstrap.timeZone}
                onSave={(timeZone) => save({ timeZone })}
              />
            </section>
          ) : null}
          {show(t("settings.appearance")) && profile ? (
            <section className="glass" id="venus-settings-appearance">
              <h2>{t("settings.appearance")}</h2>
              <label>
                {t("settings.theme")}
                <select
                  className="select"
                  value={appearance.themeMode}
                  onChange={(event) => {
                    const themeMode = event.target.value;
                    if (
                      themeMode === "light" ||
                      themeMode === "dark" ||
                      themeMode === "system"
                    ) {
                      void saveAppearance({ themeMode });
                    }
                  }}
                >
                  <option value="light">{t("theme.light")}</option>
                  <option value="dark">{t("theme.dark")}</option>
                  <option value="system">{t("theme.system")}</option>
                </select>
              </label>
              <label>
                {t("settings.blur")}
                <input
                  className="field"
                  type="number"
                  min={0}
                  max={16}
                  value={appearance.blurPx}
                  onChange={(event) =>
                    void saveAppearance({ blurPx: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                {t("settings.transparency")}
                <input
                  className="field"
                  type="number"
                  min={0.65}
                  max={0.95}
                  step={0.01}
                  value={appearance.glassAlpha}
                  onChange={(event) =>
                    void saveAppearance({
                      glassAlpha: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                {t("settings.accent")}
                <input
                  className="field"
                  value={appearance.accent}
                  onChange={(event) => {
                    try {
                      const accent = validateAccent(
                        event.target.value,
                        resolvedTheme,
                      );
                      void saveAppearance({ accent });
                    } catch {
                      setError(t("settings.error"));
                    }
                  }}
                />
              </label>
              <label>
                {t("settings.font")}
                <input
                  className="field"
                  type="number"
                  min={0.85}
                  max={1.4}
                  step={0.05}
                  value={snapshot.bootstrap.fontScale}
                  onChange={(event) =>
                    void save({ fontScale: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                {t("settings.motion")}
                <select
                  className="select"
                  value={snapshot.bootstrap.motion}
                  onChange={(event) => {
                    const motion = event.target.value;
                    if (
                      motion === "system" ||
                      motion === "off" ||
                      motion === "on"
                    )
                      void save({ motion });
                  }}
                >
                  <option value="system">{t("motion.system")}</option>
                  <option value="off">{t("motion.off")}</option>
                  <option value="on">{t("motion.on")}</option>
                </select>
              </label>
              <label>
                {t("settings.density")}
                <select
                  className="select"
                  value={snapshot.bootstrap.density}
                  onChange={(event) => {
                    const density = event.target.value;
                    if (density === "comfortable" || density === "compact")
                      void save({ density });
                  }}
                >
                  <option value="comfortable">
                    {t("density.comfortable")}
                  </option>
                  <option value="compact">{t("density.compact")}</option>
                </select>
              </label>
              <div className="cluster">
                {(["orbit", "nebula", "dawn"] as const).map((sceneId) => (
                  <button
                    key={sceneId}
                    className="btn"
                    type="button"
                    onClick={() =>
                      void saveAppearance({
                        wallpaper: { kind: "scene", sceneId },
                      })
                    }
                  >
                    {t(`scene.${sceneId}`)}
                  </button>
                ))}
              </div>
              <div className="cluster">
                <label>
                  {t("settings.gradient")}
                  <input
                    className="field"
                    defaultValue="#29264F"
                    id="gradient-from"
                  />
                </label>
                <input
                  className="field"
                  defaultValue="#D9AC83"
                  id="gradient-to"
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const from = (
                      document.getElementById(
                        "gradient-from",
                      ) as HTMLInputElement | null
                    )?.value;
                    const to = (
                      document.getElementById(
                        "gradient-to",
                      ) as HTMLInputElement | null
                    )?.value;
                    if (!from || !to) return;
                    void saveAppearance({
                      wallpaper: { kind: "gradient", from, to, angle: 160 },
                    });
                  }}
                >
                  {t("settings.gradient")}
                </button>
              </div>
              <label>
                {t("settings.wallpaper")}
                <input
                  className="field"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void storeWallpaper(
                      file,
                      props.workspace,
                      profile.id,
                      resolvedTheme,
                      setError,
                      t("settings.error"),
                    ).then((saved) => {
                      if (!saved) return;
                      setError("");
                      setSaved(t("settings.saved"));
                    });
                  }}
                />
              </label>
              <button
                className="btn"
                type="button"
                onClick={() => setConfirming("appearance")}
              >
                {t("settings.reset")}
              </button>
            </section>
          ) : null}
          {show(t("settings.modules")) ? (
            <section className="glass" id="venus-settings-modules">
              <h2>{t("settings.modules")}</h2>
              {widgetTypes.map((type) => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={snapshot.bootstrap.modules[type]}
                    onChange={(event) =>
                      void save({
                        modules: {
                          ...snapshot.bootstrap.modules,
                          [type]: event.target.checked,
                        },
                      })
                    }
                  />
                  {widgetLabel(type)}
                </label>
              ))}
              <button
                className="btn"
                type="button"
                onClick={() => setConfirming("modules")}
              >
                {t("settings.reset")}
              </button>
            </section>
          ) : null}
          {show(t("settings.layout")) && profile ? (
            <section className="glass" id="venus-settings-layout">
              <h2>{t("settings.layout")}</h2>
              <label>
                {t("profile.create")}
                <input
                  className="field"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.createProfile(
                    "minimal",
                    title || t("preset.minimal"),
                  )
                }
              >
                {t("preset.minimal")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.createProfile(
                    "productivity",
                    title || t("preset.productivity"),
                  )
                }
              >
                {t("preset.productivity")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.createProfile(
                    "personal",
                    title || t("preset.personal"),
                  )
                }
              >
                {t("preset.personal")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.duplicateProfile(profile.id)
                }
              >
                {t("profile.duplicate")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.updateProfile(
                    profile.id,
                    profile.revision,
                    { title: title || profile.title },
                  )
                }
              >
                {t("profile.rename")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => setConfirming("profile")}
              >
                {t("profile.delete")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => setConfirming("layout")}
              >
                {t("settings.reset")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.workspace.updatePreferences({
                    onboardingComplete: false,
                  })
                }
              >
                {t("settings.rerun")}
              </button>
            </section>
          ) : null}
          {show(t("settings.home")) ? (
            <section className="glass" id="venus-settings-home">
              <h2>{t("settings.home")}</h2>
              <p>{t("home.firefox")}</p>
              <p>{t("home.chrome")}</p>
              <p>{t("onboarding.permissions")}</p>
            </section>
          ) : null}
          {show(t("settings.platform")) ? (
            <section className="glass" id="venus-settings-platform">
              <h2>{t("settings.platform")}</h2>
              <p>{t("settings.probes")}</p>
              <App />
            </section>
          ) : null}
        </div>
      </div>
      {confirming ? (
        <div className="dialog-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("settings.confirm")}
          >
            <p>
              {t(
                confirming === "profile"
                  ? "repair.confirmDelete"
                  : "settings.confirm",
              )}
            </p>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                if (confirming === "appearance" && profile) {
                  void props.workspace.clearProfileAppearance(profile.id);
                  void save({
                    motion: "system",
                    density: "comfortable",
                    fontScale: 1,
                  });
                }
                if (confirming === "modules")
                  void save({
                    modules: {
                      clock: true,
                      search: true,
                      bookmarks: true,
                      upcoming: true,
                      today: true,
                      timer: true,
                      notes: true,
                      briefing: true,
                      capture: true,
                      habits: true,
                      goals: true,
                    },
                  });
                if (confirming === "profile" && profile)
                  void props.workspace
                    .deleteProfile(profile.id)
                    .catch(() => setError(t("settings.error")));
                if (confirming === "layout" && profile)
                  void props.workspace.resetLayout(profile.id, "minimal");
                setConfirming("");
              }}
            >
              {t("settings.confirm")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setConfirming("")}
            >
              {t("settings.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

async function storeWallpaper(
  file: File,
  workspace: Workspace,
  profileId: string,
  theme: "light" | "dark",
  setError: (value: string) => void,
  message: string,
) {
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("invalidInput");
    const bitmap = await createImageBitmap(file);
    const checked = validateAsset({
      mime: file.type,
      byteLength: file.size,
      width: bitmap.width,
      height: bitmap.height,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = await workspace.saveAsset({ ...checked, bytes });
    await workspace.patchProfileAppearance(
      profileId,
      { wallpaper: { kind: "upload", assetId: asset.id } },
      theme,
    );
    return true;
  } catch {
    setError(message);
    return false;
  }
}

function SearchProviderFields(props: {
  locale: "en" | "fa";
  providerId: Bootstrap["searchProviderId"];
  template: string;
  onSave: (patch: Partial<Bootstrap>) => void;
  onInvalid: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [providerId, setProviderId] = useState(props.providerId);
  const [template, setTemplate] = useState(props.template);
  useEffect(() => {
    setProviderId(props.providerId);
    setTemplate(props.template);
  }, [props.providerId, props.template]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (providerId === "custom") {
          try {
            webSearchUrl(template, "venus");
          } catch {
            props.onInvalid();
            return;
          }
          props.onSave({
            searchProviderId: "custom",
            customSearchTemplate: template,
          });
          return;
        }
        props.onSave({ searchProviderId: providerId });
      }}
    >
      <label>
        {t("search.provider")}
        <select
          className="select"
          value={providerId}
          onChange={(event) =>
            setProviderId(
              event.target.value === "google" || event.target.value === "custom"
                ? event.target.value
                : "duckduckgo",
            )
          }
        >
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="google">Google</option>
          <option value="custom">{t("search.custom")}</option>
        </select>
      </label>
      {providerId === "custom" ? (
        <label>
          {t("search.template")}
          <input
            className="field"
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
          />
        </label>
      ) : null}
      <button className="btn" type="submit">
        {t("search.saveProvider")}
      </button>
    </form>
  );
}

function TimeZoneField(props: {
  locale: "en" | "fa";
  value: string;
  onSave: (zone: string) => Promise<void>;
}) {
  const [value, setValue] = useState(props.value);
  const [error, setError] = useState("");
  const t = (key: MessageKey) => translate(props.locale, key);
  useEffect(() => setValue(props.value), [props.value]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
          setError("");
          void props.onSave(value);
        } catch {
          setError(t("settings.error"));
        }
      }}
    >
      <label>
        {t("settings.zone")}
        <input
          className="field"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button className="btn" type="submit">
        {t("settings.save")}
      </button>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
