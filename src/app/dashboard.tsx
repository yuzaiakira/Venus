import { TaskDialog } from "./tasks";
import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import type {
  BrowserBookmarkPort,
  Library,
  Productivity,
} from "../application/productivity";
import type { Workspace, WorkspaceSnapshot } from "../application/workspace";
import { appearanceOf, moduleEnabled } from "../application/workspace";
import {
  columnsFor,
  formatClock,
  logicalColumns,
  movePlacement,
  reorderPlacement,
  reflow,
  resizePlacement,
  searchTemplate,
  webSearchUrl,
  paletteShortcutAllowed,
  type ThemeMode,
  type WidgetRecord,
  type WidgetType,
  widgetTypes,
} from "../domain/dashboard";
import {
  searchPalette,
  permissionNoteKey,
  type PaletteCommand,
} from "../domain/commands";
import { canonicalHttpUrl } from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";
import type { createCalendar } from "../application/calendar";
import type { PluginPlatform } from "../application/plugins";
import type {
  EventRecord,
  NotificationRecord,
  QuietHoursRecord,
  TimerRecord,
} from "../domain/time/records";
import { CalendarPanel } from "./calendar-panel";
import { CaptureDialog } from "./capture";
import { NotificationCenter } from "./notification-center";
import { applyDocument, paintUploadedWallpaper } from "./document";
import { LibraryScreen } from "./library";
import { PluginStudio, PluginWidget } from "./plugin-studio";
import { SettingsScreen } from "./settings";
import { Icon } from "./icons";
import { WidgetBody, WidgetBoundary, WidgetChrome } from "./widgets";

const sizes = [
  { w: 1, h: 1 },
  { w: 2, h: 1 },
  { w: 2, h: 2 },
] as const;

export function DashboardScreen(props: {
  workspace: Workspace;
  productivity: Productivity;
  bookmarks: BrowserBookmarkPort;
  calendar: ReturnType<typeof createCalendar>;
  plugins: PluginPlatform;
  online: boolean;
}) {
  const [online, setOnline] = useState(props.online);
  const [systemAppearance, setSystemAppearance] = useState({
    dark: false,
    reduced: false,
  });
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () =>
      setSystemAppearance({ dark: dark.matches, reduced: reduced.matches });
    const connectivity = () => setOnline(navigator.onLine);
    change();
    dark.addEventListener("change", change);
    reduced.addEventListener("change", change);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    return () => {
      dark.removeEventListener("change", change);
      reduced.removeEventListener("change", change);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    };
  }, []);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDialogId, setTaskDialogId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const loadSequence = useRef(0);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [view, setView] = useState<
    | "home"
    | "notes"
    | "tasks"
    | "bookmarks"
    | "calendar"
    | "plugins"
    | "settings"
  >("home");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [reminders, setReminders] = useState<NotificationRecord[]>([]);
  const [quiet, setQuiet] = useState<QuietHoursRecord>({
    id: "quiet-hours",
    enabled: false,
    start: "22:00",
    end: "07:00",
    timeZone: "UTC",
  });
  const [activeTimer, setActiveTimer] = useState<TimerRecord | null>(null);
  const [captureToday, setCaptureToday] = useState(false);
  const [captureKind, setCaptureKind] = useState<"note" | "task" | "event">(
    "note",
  );
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("");
  const [bell, setBell] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.hash === "#notifications",
  );
  const [capture, setCapture] = useState(false);
  const [columns, setColumns] = useState(logicalColumns);
  const [now, setNow] = useState(() => new Date());
  const [resets, setResets] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [permissionNote, setPermissionNote] = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const [next, content, schedule] = await Promise.all([
        props.workspace.load(),
        props.productivity.load(),
        props.calendar.list(),
      ]);
      if (sequence !== loadSequence.current) return;
      setSnapshot(next);
      setLibrary(content);
      setEvents(schedule.events);
      setReminders(schedule.notifications);
      setQuiet(schedule.quietHours);
      const latestTimer = [...schedule.timers].sort(
        (a, b) => (b.startedAtUTC ?? 0) - (a.startedAtUTC ?? 0),
      )[0];
      setActiveTimer(
        schedule.timers.find(
          (item) => item.status === "running" || item.status === "paused",
        ) ?? (latestTimer?.status === "finished" ? latestTimer : null),
      );
      setLoadError(false);
    } catch {
      if (sequence === loadSequence.current) setLoadError(true);
    }
  }, [props.workspace, props.productivity, props.calendar]);
  async function completeOnboarding() {
    const bootstrap = await props.workspace.updatePreferences({
      onboardingComplete: true,
    });
    setSnapshot((current) => (current ? { ...current, bootstrap } : current));
  }
  useEffect(() => {
    void reload();
    const unsubscribe = props.workspace.subscribe(() => void reload());
    return () => {
      ++loadSequence.current;
      unsubscribe();
    };
  }, [props.workspace, reload]);
  useEffect(() => {
    if (
      !activeTimer ||
      activeTimer.status !== "running" ||
      !activeTimer.endsAtUTC
    )
      return;
    const handle = window.setTimeout(
      () => {
        void props.calendar
          .reconcile(false)
          .then(reload)
          .catch(() => setLoadError(true));
      },
      Math.min(2_147_483_647, Math.max(0, activeTimer.endsAtUTC - Date.now())),
    );
    return () => window.clearTimeout(handle);
  }, [activeTimer, props.calendar, reload]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const measure = () => setColumns(columnsFor(window.innerWidth));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
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
      prefersDark: systemAppearance.dark,
      reducedMotion: systemAppearance.reduced,
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
  }, [snapshot, props.workspace, systemAppearance]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      const target = event.target;
      const tag = target instanceof Element ? target.tagName : "";
      const editable =
        target instanceof HTMLElement ? target.isContentEditable : false;
      if (meta && event.key.toLowerCase() === "k") {
        if (!paletteShortcutAllowed(tag, editable)) return;
        event.preventDefault();
        setPalette((open) => !open);
      } else if (event.key === "Escape") {
        setPalette(false);
        setBell(false);
        setCapture(false);
        setFabOpen(false);
        setProfileMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const t = (key: MessageKey) =>
    translate(snapshot?.bootstrap.locale ?? "en", key);
  const profile = snapshot?.profiles.find(
    (item) => item.id === snapshot.bootstrap.selectedProfileId,
  );
  const widgets = useMemo(() => {
    if (!snapshot || !profile) return [];
    return snapshot.widgets.filter(
      (widget) =>
        widget.profileId === profile.id &&
        (editing || widget.visible) &&
        moduleEnabled(snapshot.bootstrap, widget.widgetType),
    );
  }, [snapshot, profile, editing]);
  const placements = widgets.map((widget) => ({
    id: widget.id,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
  }));
  const display =
    columns === logicalColumns ? placements : reflow(placements, columns);
  const commands = useMemo(() => {
    if (!snapshot) return [];
    const local: PaletteCommand[] = [
      {
        id: "settings",
        label: t("command.settings"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "edit",
        label: t("command.edit"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "search",
        label: t("command.search"),
        group: "local",
        available: true,
        profileId: "",
      },
      ...snapshot.profiles.map((item) => ({
        id: `profile:${item.id}`,
        label: `${t("command.profile")} ${item.title}`,
        group: "local" as const,
        available: true,
        profileId: item.id,
      })),
      {
        id: "web",
        label: t("search.submit"),
        group: "web",
        available: online,
        profileId: "",
      },
      {
        id: "note",
        label: t("command.note"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "task",
        label: t("command.task"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "event",
        label: t("command.event"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "notes",
        label: t("command.notes"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "tasks",
        label: t("command.tasks"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "bookmarks",
        label: t("command.bookmarks"),
        group: "local",
        available: true,
        profileId: "",
      },
      {
        id: "timer",
        label: t("command.timer"),
        group: "local",
        available: true,
        profileId: "",
      },
    ];
    return searchPalette(
      local,
      library ?? { notes: [], tasks: [], bookmarks: [] },
      query,
    );
  }, [snapshot, library, query, online, t]);

  if (!snapshot || !profile) {
    return (
      <div className="shell">
        <div className="space-layer" aria-hidden="true">
          <div className="space-stars" />
        </div>
        <main className="workspace">
          <h1>{t("app.title")}</h1>
          {loadError ? (
            <div role="alert">
              <p>{t("settings.error")}</p>
              <button
                className="btn"
                type="button"
                onClick={() => void reload()}
              >
                {t("repair.retry")}
              </button>
            </div>
          ) : null}
        </main>
      </div>
    );
  }

  const appearance = appearanceOf(snapshot, profile);
  const clock = formatClock(now, snapshot.bootstrap);
  const navItems = [
    { id: "home" as const, icon: "grid" as const, label: t("nav.home") },
    {
      id: "tasks" as const,
      icon: "checkCircle" as const,
      label: t("nav.tasks"),
    },
    { id: "notes" as const, icon: "note" as const, label: t("nav.notes") },
    {
      id: "calendar" as const,
      icon: "calendar" as const,
      label: t("nav.calendar"),
    },
    {
      id: "bookmarks" as const,
      icon: "bookmark" as const,
      label: t("nav.bookmarks"),
    },
    {
      id: "plugins" as const,
      icon: "plugins" as const,
      label: t("nav.plugins"),
    },
  ];

  const profileId = profile.id;

  async function cycleTheme() {
    const order: ThemeMode[] = ["dark", "light", "system"];
    const current = appearance.themeMode;
    const next = order[(order.indexOf(current) + 1) % order.length] ?? "dark";
    await props.workspace.patchProfileAppearance(
      profileId,
      { themeMode: next },
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next,
    );
  }

  async function persistMove(widget: WidgetRecord, dx: number, dy: number) {
    const current = widgets.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));
    try {
      await props.workspace.savePlacements(
        profile!.id,
        movePlacement(current, widget.id, dx, dy),
      );
    } catch {
      setNotice(t("settings.error"));
    }
  }
  async function persistSize(widget: WidgetRecord, w: number, h: number) {
    const current = widgets.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));
    try {
      await props.workspace.savePlacements(
        profile!.id,
        resizePlacement(current, widget.id, w, h),
      );
    } catch {
      setNotice(t("settings.error"));
    }
  }
  async function persistWidgetDrop(widgetId: string, targetId: string) {
    if (widgetId === targetId) return;
    const current = widgets.map((item) => ({
      id: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));
    try {
      await props.workspace.savePlacements(
        profile!.id,
        reorderPlacement(current, widgetId, targetId),
      );
    } catch {
      setNotice(t("settings.error"));
    }
  }
  async function runCommand(command: PaletteCommand | undefined) {
    if (!command) return;
    if (!command.available) {
      setNotice(t("capture.later"));
      return;
    }
    if (command.id.startsWith("open-note:")) {
      setSelectedNoteId(command.id.slice("open-note:".length));
      setView("notes");
    }
    if (command.id.startsWith("open-task:")) {
      setSelectedTaskId(command.id.slice("open-task:".length));
      setView("tasks");
    }
    if (command.id.startsWith("open-bookmark:")) {
      const bookmark = library?.bookmarks.find(
        (item) => item.id === command.id.slice("open-bookmark:".length),
      );
      if (bookmark) {
        try {
          window.open(
            canonicalHttpUrl(bookmark.url),
            "_blank",
            "noopener,noreferrer",
          );
        } catch {
          setNotice(t("bookmarks.rejected"));
        }
      }
    }
    if (command.id === "settings") setView("settings");
    if (command.id === "edit") setEditing((value) => !value);
    if (command.id === "search") {
      setView("home");
      window.setTimeout(
        () => document.getElementById("dashboard-search")?.focus(),
        0,
      );
    }
    if (
      command.id === "note" ||
      command.id === "task" ||
      command.id === "event"
    ) {
      setCaptureToday(false);
      setCaptureKind(command.id);
      setCapture(true);
    }
    if (
      command.id === "notes" ||
      command.id === "tasks" ||
      command.id === "bookmarks"
    )
      setView(command.id);
    if (command.id === "timer") {
      try {
        await props.calendar.startTimer({
          mode: "pomodoro",
          durationMs: 25 * 60_000,
        });
        await reload();
        setBell(true);
      } catch {
        setNotice(t("settings.error"));
      }
    }
    if (command.profileId)
      await props.workspace.switchProfile(command.profileId);
    if (command.id === "web") {
      if (!online) setNotice(t("search.offline"));
      else if (query.trim()) {
        try {
          window.open(
            webSearchUrl(searchTemplate(snapshot!.bootstrap), query),
            "_blank",
            "noopener,noreferrer",
          );
        } catch {
          setNotice(t("search.invalid"));
        }
      }
    }
    setPalette(false);
  }

  return (
    <div className="shell">
      <div className="space-layer" aria-hidden="true">
        <div className="space-stars" />
      </div>
      <div className="app-shell">
        <aside className="sidebar" aria-label={t("nav.home")}>
          <button
            className="side-logo"
            type="button"
            aria-label={t("app.title")}
            onClick={() => setView("home")}
          >
            <span className="mark-orbit">✦</span>
          </button>
          <div className="side-rule" />
          <nav className="side-nav" aria-label={t("nav.home")}>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`side-link${view === item.id ? " active" : ""}`}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="side-bottom">
            <button
              className={`side-link${view === "settings" ? " active" : ""}`}
              type="button"
              title={t("nav.settings")}
              aria-label={t("nav.settings")}
              aria-current={view === "settings" ? "page" : undefined}
              onClick={() => setView("settings")}
            >
              <Icon name="settings" />
              <span>{t("nav.settings")}</span>
            </button>
            <span className="side-avatar" title={profile.title}>
              V
            </span>
          </div>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <div className="brand">
              <div className="brand-symbol" aria-hidden="true">
                <span>✦</span>
              </div>
              <div>
                <div className="brand-name">
                  venus<span className="brand-dot">.</span>
                </div>
                <div className="brand-sub">{t("app.brandSub")}</div>
              </div>
              <span className="beta">{t("app.beta")}</span>
            </div>
            <div className="top-actions">
              <span className="privacy">
                <span className="privacy-dot" aria-hidden="true" />
                <Icon name="lock" />
                <span>{t("app.privacy")}</span>
              </span>
              <div className="top-divider" aria-hidden="true" />
              <button
                className="circle-btn"
                type="button"
                title={t("settings.theme")}
                aria-label={t("settings.theme")}
                onClick={() => void cycleTheme()}
              >
                <Icon
                  name={appearance.themeMode === "light" ? "moon" : "sun"}
                />
              </button>
              <button
                className="circle-btn"
                type="button"
                aria-expanded={bell}
                aria-label={t("nav.notifications")}
                onClick={() => {
                  setBell((value) => !value);
                  setProfileMenu(false);
                }}
              >
                <Icon name="bell" />
                {reminders.some(
                  (row) =>
                    row.internalStatus === "due" ||
                    row.internalStatus === "missed",
                ) ? (
                  <i className="notification-dot" aria-hidden="true" />
                ) : null}
              </button>
              <button
                className="circle-btn"
                type="button"
                aria-label={t("nav.palette")}
                onClick={() => setPalette(true)}
              >
                <Icon name="search" />
              </button>
              <button
                className="profile-switch"
                type="button"
                aria-haspopup="true"
                aria-expanded={profileMenu}
                onClick={() => setProfileMenu((value) => !value)}
              >
                <span className="profile-dot" aria-hidden="true">
                  ✦
                </span>
                <span>{profile.title}</span>
                <Icon name="chevron" />
              </button>
              {profileMenu ? (
                <div className="profile-menu" role="menu">
                  {snapshot.profiles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      aria-current={item.id === profile.id ? "true" : undefined}
                      onClick={() => {
                        void props.workspace.switchProfile(item.id);
                        setProfileMenu(false);
                      }}
                    >
                      ✦ &nbsp; {item.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <div className="workspace-main">
            {loadError ? (
              <p className="error" role="alert">
                {t("settings.error")}
              </p>
            ) : null}
            <button
              className="btn mobile-settings"
              type="button"
              onClick={() => setView("settings")}
            >
              {t("nav.settings")}
            </button>
            {bell ? (
              <NotificationCenter
                locale={snapshot.bootstrap.locale}
                rows={reminders}
                quiet={quiet}
                timer={activeTimer}
                calendar={props.calendar}
                onChanged={reload}
              />
            ) : null}
            {view === "settings" ? (
              <SettingsScreen
                workspace={props.workspace}
                onHome={() => setView("home")}
              />
            ) : null}
            {view === "plugins" ? (
              <PluginStudio
                platform={props.plugins}
                profileId={
                  snapshot.profiles.find(
                    (item) => item.id === snapshot.bootstrap.selectedProfileId,
                  )?.id ?? ""
                }
                locale={snapshot.bootstrap.locale}
                now={now}
                onChanged={() => void reload()}
              />
            ) : null}
            {view === "calendar" ? (
              <CalendarPanel
                bootstrap={snapshot.bootstrap}
                events={events}
                calendar={props.calendar}
                onChanged={reload}
              />
            ) : null}
            {view === "home" ? (
              <>
                <section className="hero card-glass" aria-label={t("nav.home")}>
                  <div className="hero-text">
                    <div className="eyebrow">
                      <span className="eyebrow-star" aria-hidden="true">
                        ✦
                      </span>
                      <span>{t("hero.eyebrow")}</span>
                      <span className="eyebrow-line" aria-hidden="true" />
                    </div>
                    <h1>
                      <span>{t("hero.first")}</span>
                      <br />
                      <em>{t("hero.second")}</em>
                    </h1>
                    <p className="hero-desc">{t("hero.desc")}</p>
                    <form
                      className="hero-search"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        const value = String(data.get("q") ?? "");
                        if (!online) {
                          setNotice(t("search.offline"));
                          return;
                        }
                        try {
                          window.open(
                            webSearchUrl(
                              searchTemplate(snapshot.bootstrap),
                              value,
                            ),
                            "_blank",
                            "noopener,noreferrer",
                          );
                        } catch {
                          setNotice(t("search.invalid"));
                        }
                      }}
                    >
                      <Icon name="search" />
                      <input
                        id="dashboard-search"
                        name="q"
                        type="search"
                        aria-label={t("search.label")}
                        placeholder={t("search.placeholder")}
                      />
                      <kbd>Ctrl K</kbd>
                    </form>
                    <p
                      className="muted"
                      style={{ marginTop: "1rem", fontSize: 11 }}
                    >
                      {t("home.heading")}
                    </p>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="hero-orbit orbit-outer" />
                    <div className="hero-orbit orbit-mid" />
                    <div className="hero-orbit orbit-inner" />
                    <div className="hero-planet" />
                    <i className="satellite sat-a" />
                    <i className="satellite sat-b" />
                    <div className="clock-stack">
                      <span className="clock-label">{t("hero.localTime")}</span>
                      <div className="hero-clock">{clock.time}</div>
                      <span className="clock-date">
                        {clock.dates[0] ?? clock.dates.join(" · ")}
                      </span>
                    </div>
                  </div>
                </section>

                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      {t("hero.overviewKicker")}
                    </span>
                    <h2>{t("hero.overview")}</h2>
                  </div>
                  <button
                    className="text-btn"
                    type="button"
                    onClick={() => setEditing((value) => !value)}
                  >
                    <Icon name="sliders" />
                    <span>{editing ? t("nav.done") : t("hero.customize")}</span>
                  </button>
                </div>
              </>
            ) : null}
            {library &&
            view !== "home" &&
            view !== "calendar" &&
            view !== "plugins" &&
            view !== "settings" ? (
              <LibraryScreen
                view={view}
                selectedNoteId={selectedNoteId}
                selectedTaskId={selectedTaskId}
                onSelectedNote={setSelectedNoteId}
                onSelectedTask={setSelectedTaskId}
                library={library}
                productivity={props.productivity}
                bookmarks={props.bookmarks}
                locale={snapshot.bootstrap.locale}
              />
            ) : null}
            {view === "home" ? (
              <>
                <div
                  className="grid"
                  style={{
                    ["--columns" as string]: columns,
                  }}
                >
                  {widgets.map((widget) => {
                    const box =
                      display.find((item) => item.id === widget.id) ?? widget;
                    const openModule =
                      widget.widgetType === "notes"
                        ? () => setView("notes")
                        : widget.widgetType === "today"
                          ? () => setView("tasks")
                          : widget.widgetType === "upcoming"
                            ? () => setView("calendar")
                            : widget.widgetType === "bookmarks"
                              ? () => setView("bookmarks")
                              : undefined;
                    return (
                      <article
                        key={widget.id}
                        className={`card-glass widget${draggingWidgetId === widget.id ? " is-dragging" : ""}`}
                        data-hidden={widget.visible ? "false" : "true"}
                        draggable={editing}
                        onDragStart={(event) => {
                          if (!editing) return;
                          event.dataTransfer.setData(
                            "text/venus-widget",
                            widget.id,
                          );
                          event.dataTransfer.effectAllowed = "move";
                          setDraggingWidgetId(widget.id);
                        }}
                        onDragEnd={() => setDraggingWidgetId(null)}
                        onDragOver={(event) => {
                          if (editing && draggingWidgetId !== widget.id)
                            event.preventDefault();
                        }}
                        onDrop={(event) => {
                          if (!editing) return;
                          event.preventDefault();
                          const id =
                            event.dataTransfer.getData("text/venus-widget");
                          if (id) void persistWidgetDrop(id, widget.id);
                          setDraggingWidgetId(null);
                        }}
                        style={{
                          gridColumn: `${box.x + 1} / span ${box.w}`,
                          gridRow: `${box.y + 1} / span ${box.h}`,
                        }}
                      >
                        <WidgetBoundary
                          key={`${widget.id}:${widget.revision}:${resets[widget.id] ?? 0}`}
                          widgetId={widget.id}
                          locale={snapshot.bootstrap.locale}
                          onReset={() =>
                            setResets((current) => ({
                              ...current,
                              [widget.id]: (current[widget.id] ?? 0) + 1,
                            }))
                          }
                          onCrash={() => {
                            if (widget.widgetType !== "plugin") return;
                            const pluginId = widget.settings.pluginId;
                            if (typeof pluginId === "string")
                              void props.plugins.recordCrash(pluginId);
                          }}
                          onDisable={() =>
                            void props.workspace.setWidget(
                              widget.id,
                              widget.revision,
                              {
                                visible: false,
                              },
                            )
                          }
                        >
                          {widget.widgetType === "plugin" &&
                          typeof widget.settings.pluginId === "string" &&
                          typeof widget.settings.instanceId === "string" ? (
                            <PluginWidget
                              platform={props.plugins}
                              pluginId={widget.settings.pluginId}
                              instanceId={widget.settings.instanceId}
                              locale={snapshot.bootstrap.locale}
                              now={now}
                              crash={widget.settings.pluginFault === true}
                            />
                          ) : (
                            <WidgetChrome
                              widget={widget}
                              locale={snapshot.bootstrap.locale}
                              onOpen={openModule}
                            >
                              <WidgetBody
                                widget={widget}
                                bootstrap={snapshot.bootstrap}
                                shared={snapshot.shared}
                                now={now}
                                online={online}
                                notes={library?.notes ?? []}
                                tasks={library?.tasks ?? []}
                                bookmarks={library?.bookmarks ?? []}
                                events={events}
                                timer={activeTimer}
                                onWebSearch={(value) => {
                                  if (!online) {
                                    setNotice(t("search.offline"));
                                    return;
                                  }
                                  try {
                                    window.open(
                                      webSearchUrl(
                                        searchTemplate(snapshot.bootstrap),
                                        value,
                                      ),
                                      "_blank",
                                      "noopener",
                                    );
                                  } catch {
                                    setNotice(t("search.invalid"));
                                  }
                                }}
                                onToggleTask={(id, revision, done) =>
                                  void props.productivity
                                    .saveTask(id, revision, {
                                      status: done ? "done" : "open",
                                    })
                                    .then(() => reload())
                                    .catch(() => setNotice(t("settings.error")))
                                }
                                onOpenNote={(id) => {
                                  setSelectedNoteId(id);
                                  setView("notes");
                                }}
                                onOpenTask={(id) => setTaskDialogId(id)}
                                onCreateTask={() => {
                                  setCaptureToday(true);
                                  setCaptureKind("task");
                                  setCapture(true);
                                }}
                                onMoveToday={(id, direction) => {
                                  const rows = (library?.tasks ?? [])
                                    .filter((task) => task.today)
                                    .sort(
                                      (a, b) =>
                                        (a.todayOrder ?? 0) -
                                        (b.todayOrder ?? 0),
                                    );
                                  const index = rows.findIndex(
                                    (task) => task.id === id,
                                  );
                                  const other = rows[index + direction];
                                  const current = rows[index];
                                  if (!other || !current) return;
                                  rows[index] = other;
                                  rows[index + direction] = current;
                                  void props.productivity
                                    .reorderToday(rows)
                                    .catch(() =>
                                      setNotice(t("settings.error")),
                                    );
                                }}
                                onStartTimer={() =>
                                  void props.calendar
                                    .startTimer({
                                      mode: "pomodoro",
                                      durationMs: 25 * 60_000,
                                    })
                                    .then(() => reload())
                                    .catch(() => setNotice(t("settings.error")))
                                }
                                onPauseTimer={() => {
                                  if (!activeTimer) return;
                                  void props.calendar
                                    .pauseTimer(activeTimer.id)
                                    .then(() => reload())
                                    .catch(() =>
                                      setNotice(t("settings.error")),
                                    );
                                }}
                                onResumeTimer={() => {
                                  if (!activeTimer) return;
                                  void props.calendar
                                    .resumeTimer(activeTimer.id)
                                    .then(() => reload())
                                    .catch(() =>
                                      setNotice(t("settings.error")),
                                    );
                                }}
                                onResetTimer={() => {
                                  if (!activeTimer) return;
                                  void props.calendar
                                    .resetTimer(activeTimer.id)
                                    .then(() => reload())
                                    .catch(() =>
                                      setNotice(t("settings.error")),
                                    );
                                }}
                              />
                            </WidgetChrome>
                          )}
                        </WidgetBoundary>
                        {editing ? (
                          <div className="widget-actions">
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void persistMove(widget, -1, 0)}
                            >
                              {t("widget.move")} ←
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void persistMove(widget, 1, 0)}
                            >
                              {t("widget.move")} →
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void persistMove(widget, 0, -1)}
                            >
                              {t("widget.move")} ↑
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => void persistMove(widget, 0, 1)}
                            >
                              {t("widget.move")} ↓
                            </button>
                            {sizes.map((size) => (
                              <button
                                key={`${size.w}x${size.h}`}
                                className="btn"
                                type="button"
                                onClick={() =>
                                  void persistSize(widget, size.w, size.h)
                                }
                              >
                                {t("widget.resize")} {size.w}x{size.h}
                              </button>
                            ))}
                            <button
                              className="btn"
                              type="button"
                              onClick={() =>
                                void props.workspace.setWidget(
                                  widget.id,
                                  widget.revision,
                                  { visible: !widget.visible },
                                )
                              }
                            >
                              {widget.visible ? t("edit.hide") : t("edit.show")}
                            </button>
                            <button
                              className="btn"
                              type="button"
                              onClick={() =>
                                void props.workspace.removeWidget(widget.id)
                              }
                            >
                              {t("edit.remove")}
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {editing ? (
                  <div className="cluster">
                    <label>
                      {t("edit.add")}
                      <select
                        className="select"
                        defaultValue=""
                        onChange={(event) => {
                          const type = event.target.value as WidgetType;
                          if (widgetTypes.includes(type))
                            void props.workspace.addWidget(profile.id, type);
                          event.target.value = "";
                        }}
                      >
                        <option value="">{t("edit.add")}</option>
                        {widgetTypes
                          .filter(
                            (type) =>
                              !widgets.some(
                                (widget) => widget.widgetType === type,
                              ),
                          )
                          .map((type) => (
                            <option key={type} value={type}>
                              {widgetLabel(type, t)}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                ) : null}
                <footer className="page-footer">
                  <span>
                    <span className="footer-spark" aria-hidden="true">
                      ✦
                    </span>{" "}
                    {t("hero.footerLeft")}
                  </span>
                  <span>{t("hero.footerRight")}</span>
                </footer>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <button
        className="floating-add"
        type="button"
        id="fab"
        title={t("fab.menu")}
        aria-label={t("fab.menu")}
        aria-expanded={fabOpen}
        onClick={() => setFabOpen((value) => !value)}
      >
        <Icon name="plus" />
      </button>
      {fabOpen ? (
        <div className="fab-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCaptureToday(false);
              setCaptureKind("task");
              setCapture(true);
              setFabOpen(false);
            }}
          >
            <Icon name="checkCircle" /> {t("command.task")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCaptureKind("note");
              setCapture(true);
              setFabOpen(false);
            }}
          >
            <Icon name="note" /> {t("command.note")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setCaptureKind("event");
              setCapture(true);
              setFabOpen(false);
            }}
          >
            <Icon name="calendar" /> {t("command.event")}
          </button>
        </div>
      ) : null}

      {taskDialogId &&
      library?.tasks.find((task) => task.id === taskDialogId) ? (
        <TaskDialog
          key={taskDialogId}
          task={library.tasks.find((task) => task.id === taskDialogId)!}
          productivity={props.productivity}
          locale={snapshot.bootstrap.locale}
          onClose={() => setTaskDialogId(null)}
        />
      ) : null}
      {notice ? (
        <p className="toast glass" role="status">
          {notice}
        </p>
      ) : null}
      {palette ? (
        <div className="dialog-backdrop">
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.palette")}
          >
            <p className="muted">{t("palette.shortcut")}</p>
            <input
              className="field"
              autoFocus
              placeholder={t("palette.placeholder")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelected((index) =>
                    Math.max(0, Math.min(commands.length - 1, index + 1)),
                  );
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelected((index) => Math.max(0, index - 1));
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runCommand(commands[selected]);
                }
              }}
            />
            <ul
              className="palette-list"
              role="listbox"
              aria-label={t("nav.palette")}
            >
              {commands.map((command, index) => (
                <li key={command.id} role="presentation">
                  <button
                    className="btn"
                    type="button"
                    role="option"
                    aria-selected={index === selected}
                    onClick={() => void runCommand(command)}
                  >
                    <bdi>{command.label}</bdi>
                    <span className="muted">
                      {command.group === "local"
                        ? t("palette.local")
                        : command.group === "web"
                          ? t("palette.web")
                          : t("palette.unavailable")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {commands.length === 0 ? <p>{t("palette.empty")}</p> : null}
            <button
              className="btn"
              type="button"
              onClick={() => setPalette(false)}
            >
              {t("dialog.close")}
            </button>
          </div>
        </div>
      ) : null}
      {capture ? (
        <CaptureDialog
          locale={snapshot.bootstrap.locale}
          kind={captureKind}
          taskToday={captureToday}
          productivity={props.productivity}
          onCreateEvent={async (title, details) => {
            const basis =
              snapshot.bootstrap.calendarDisplay === "jalali"
                ? "jalali"
                : "gregorian";
            await props.calendar.createEvent({
              title,
              description: details,
              basis,
              allDay: true,
              zoneId: snapshot.bootstrap.timeZone,
              offsetMinutes: [15],
            });
            await reload();
          }}
          onClose={() => setCapture(false)}
          onKind={setCaptureKind}
        />
      ) : null}
      {snapshot.bootstrap.onboardingComplete ? null : (
        <Onboarding
          locale={snapshot.bootstrap.locale}
          calendarDisplay={snapshot.bootstrap.calendarDisplay}
          hourFormat={snapshot.bootstrap.hourFormat}
          themeMode={appearanceOf(snapshot, profile).themeMode}
          preset={profile.preset === "custom" ? "minimal" : profile.preset}
          step={step}
          note={permissionNote}
          onSkip={() => void completeOnboarding()}
          onBack={() => setStep((value) => Math.max(0, value - 1))}
          onNext={() => setStep((value) => value + 1)}
          onFinish={() => void completeOnboarding()}
          onLocale={(locale) =>
            void props.workspace.updatePreferences({ locale })
          }
          onCalendar={(calendarDisplay) =>
            void props.workspace.updatePreferences({ calendarDisplay })
          }
          onHour={(hourFormat) =>
            void props.workspace.updatePreferences({ hourFormat })
          }
          onTheme={(themeMode) =>
            void props.workspace.patchProfileAppearance(
              profile.id,
              { themeMode },
              themeMode === "dark" ? "dark" : "light",
            )
          }
          onPreset={(preset) =>
            void props.workspace.resetLayout(profile.id, preset)
          }
          onPermission={async (name) => {
            if (import.meta.env.VITE_VENUS_PERMISSION_ADAPTER === "denied") {
              document.documentElement.dataset.permissionAdapter =
                "controlled-denial";
              setPermissionNote(t("onboarding.denied"));
              return;
            }
            const { requestOptional } = await import(
              "../infrastructure/browser-workspace"
            );
            const outcome = await requestOptional(name);
            setPermissionNote(t(permissionNoteKey(outcome)));
          }}
        />
      )}
    </div>
  );
}

function widgetLabel(type: WidgetType, t: (key: MessageKey) => string) {
  const labels: Record<WidgetType, MessageKey> = {
    clock: "widget.clockTitle",
    search: "widget.searchTitle",
    bookmarks: "widget.linksTitle",
    upcoming: "widget.calendarTitle",
    today: "nav.tasks",
    timer: "widget.focusTitle",
    notes: "widget.notesTitle",
    briefing: "widget.briefingTitle",
  };
  return t(labels[type]);
}

function Onboarding(props: {
  locale: "en" | "fa";
  calendarDisplay: "gregorian" | "jalali" | "both";
  hourFormat: 12 | 24;
  themeMode: ThemeMode;
  preset: "minimal" | "productivity" | "personal";
  step: number;
  note: string;
  onSkip: () => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  onLocale: (locale: "en" | "fa") => void;
  onCalendar: (value: "gregorian" | "jalali" | "both") => void;
  onHour: (value: 12 | 24) => void;
  onTheme: (value: "light" | "dark" | "system") => void;
  onPreset: (value: "minimal" | "productivity" | "personal") => void;
  onPermission: (name: "bookmarks" | "notifications") => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const heading =
    props.step === 1
      ? t("onboarding.localeStep")
      : props.step === 2
        ? t("onboarding.themeStep")
        : props.step === 3
          ? t("onboarding.presetStep")
          : t("onboarding.welcome");
  return (
    <div className="dialog-backdrop">
      <div
        className="dialog onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <h2>{heading}</h2>
        {props.step === 0 ? <p>{t("onboarding.privacy")}</p> : null}
        {props.step === 1 ? (
          <div className="onboarding-step">
            <section className="onboarding-group">
              <h3>{t("settings.locale")}</h3>
              <p className="muted">{t("onboarding.localeHelp")}</p>
              <div className="cluster">
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.locale === "fa"}
                  onClick={() => props.onLocale("fa")}
                >
                  فارسی
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.locale === "en"}
                  onClick={() => props.onLocale("en")}
                >
                  English
                </button>
              </div>
            </section>
            <section className="onboarding-group">
              <h3>{t("settings.calendar")}</h3>
              <p className="muted">{t("onboarding.calendarHelp")}</p>
              <div className="cluster">
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.calendarDisplay === "jalali"}
                  onClick={() => props.onCalendar("jalali")}
                >
                  {t("calendar.jalali")}
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.calendarDisplay === "gregorian"}
                  onClick={() => props.onCalendar("gregorian")}
                >
                  {t("calendar.gregorian")}
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.calendarDisplay === "both"}
                  onClick={() => props.onCalendar("both")}
                >
                  {t("calendar.both")}
                </button>
              </div>
            </section>
            <section className="onboarding-group">
              <h3>{t("settings.hour")}</h3>
              <p className="muted">{t("onboarding.hourHelp")}</p>
              <div className="cluster">
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.hourFormat === 24}
                  onClick={() => props.onHour(24)}
                >
                  {t("onboarding.hour24")}
                </button>
                <button
                  className="btn"
                  type="button"
                  aria-pressed={props.hourFormat === 12}
                  onClick={() => props.onHour(12)}
                >
                  {t("onboarding.hour12")}
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {props.step === 2 ? (
          <div className="onboarding-step">
            <section className="onboarding-group">
              <p className="muted">{t("onboarding.themeHelp")}</p>
              <div className="cluster">
                {(["light", "dark", "system"] as const).map((mode) => (
                  <button
                    key={mode}
                    className="btn"
                    type="button"
                    aria-pressed={props.themeMode === mode}
                    onClick={() => props.onTheme(mode)}
                  >
                    {t(`theme.${mode}`)}
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}
        {props.step === 3 ? (
          <div className="onboarding-step">
            <section className="onboarding-group">
              <p className="muted">{t("onboarding.presetHelp")}</p>
              <div className="cluster">
                {(["minimal", "productivity", "personal"] as const).map(
                  (preset) => (
                    <button
                      key={preset}
                      className="btn"
                      type="button"
                      aria-pressed={props.preset === preset}
                      onClick={() => props.onPreset(preset)}
                    >
                      {t(`preset.${preset}`)}
                    </button>
                  ),
                )}
              </div>
            </section>
          </div>
        ) : null}
        {props.step === 4 ? (
          <div className="onboarding-step">
            <p>{t("onboarding.permissions")}</p>
            <div className="cluster">
              <button
                className="btn"
                type="button"
                onClick={() => props.onPermission("bookmarks")}
              >
                {t("onboarding.request")} bookmarks
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => props.onPermission("notifications")}
              >
                {t("onboarding.request")} notifications
              </button>
            </div>
            {props.note ? <p role="status">{props.note}</p> : null}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={props.onSkip}>
            {t("onboarding.skip")}
          </button>
          {props.step > 0 ? (
            <button className="btn" type="button" onClick={props.onBack}>
              {t("onboarding.back")}
            </button>
          ) : null}
          {props.step < 4 ? (
            <button
              className="btn primary"
              type="button"
              onClick={props.onNext}
            >
              {t("onboarding.next")}
            </button>
          ) : (
            <button
              className="btn primary"
              type="button"
              onClick={props.onFinish}
            >
              {t("onboarding.finish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
