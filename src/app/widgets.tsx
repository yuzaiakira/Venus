import { Component, type ReactNode } from "react";
import {
  formatClock,
  weekLabels,
  type Bootstrap,
  type SharedItem,
  type WidgetRecord,
} from "../domain/dashboard";
import {
  blockPlain,
  iconFallback,
  previewNotes,
  previewQuickLinks,
  previewTodayTasks,
  type LocalBookmarkRecord,
  type NoteRecord,
  type TaskRecord,
  type HabitRecord,
  habitStreak,
} from "../domain/productivity";
import type { EventRecord, TimerRecord } from "../domain/time/records";
import type { GoalDetails } from "../application/goals";
import { translate, type MessageKey } from "../locales/messages";
import { Icon, type IconName } from "./icons";

const chrome: Record<
  string,
  {
    icon: IconName;
    tone: "purple" | "blue" | "pink" | "orange";
    title: MessageKey;
    sub: MessageKey;
  }
> = {
  today: {
    icon: "checkCircle",
    tone: "purple",
    title: "widget.todayTitle",
    sub: "widget.todaySub",
  },
  upcoming: {
    icon: "calendar",
    tone: "blue",
    title: "widget.calendarTitle",
    sub: "widget.calendarSub",
  },
  notes: {
    icon: "note",
    tone: "pink",
    title: "widget.notesTitle",
    sub: "widget.notesSub",
  },
  bookmarks: {
    icon: "bookmark",
    tone: "orange",
    title: "widget.linksTitle",
    sub: "widget.linksSub",
  },
  timer: {
    icon: "clock",
    tone: "purple",
    title: "widget.focusTitle",
    sub: "widget.focusSub",
  },
  clock: {
    icon: "clock",
    tone: "blue",
    title: "widget.clockTitle",
    sub: "widget.clockSub",
  },
  search: {
    icon: "search",
    tone: "purple",
    title: "widget.searchTitle",
    sub: "widget.searchSub",
  },
  briefing: {
    icon: "clock",
    tone: "purple",
    title: "widget.briefingTitle",
    sub: "widget.briefingSub",
  },
  capture: {
    icon: "note",
    tone: "pink",
    title: "widget.captureTitle",
    sub: "widget.captureSub",
  },
  habits: {
    icon: "checkCircle",
    tone: "purple",
    title: "widget.habitsTitle",
    sub: "widget.habitsSub",
  },
  goals: {
    icon: "grid",
    tone: "orange",
    title: "widget.goalsTitle",
    sub: "widget.goalsSub",
  },
};

export function WidgetChrome(props: {
  widget: WidgetRecord;
  locale: Bootstrap["locale"];
  children: ReactNode;
  onOpen?: (() => void) | undefined;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const meta = chrome[props.widget.widgetType];
  if (!meta) {
    return (
      <>
        <p className="muted">{props.widget.widgetType}</p>
        {props.children}
      </>
    );
  }
  return (
    <>
      <div className="widget-head">
        <div className={`widget-icon ${meta.tone}`}>
          <Icon name={meta.icon} />
        </div>
        <div className="widget-title">
          <h3>{t(meta.title)}</h3>
          <span>{t(meta.sub)}</span>
        </div>
        {props.onOpen ? (
          <button
            className="subtle-btn"
            type="button"
            aria-label={t(meta.title)}
            onClick={props.onOpen}
          >
            <Icon name="arrow" />
          </button>
        ) : null}
      </div>
      <div className="widget-body">{props.children}</div>
    </>
  );
}

export function WidgetBody(props: {
  widget: WidgetRecord;
  bootstrap: Bootstrap;
  shared: SharedItem[];
  notes: NoteRecord[];
  tasks: TaskRecord[];
  habits: HabitRecord[];
  goals: GoalDetails[];
  bookmarks: LocalBookmarkRecord[];
  events: EventRecord[];
  timer: TimerRecord | null;
  now: Date;
  online: boolean;
  onWebSearch: (query: string) => void;
  onCapture?: ((kind: "note" | "task" | "event") => void) | undefined;
  onToggleHabit?:
    | ((id: string, revision: number, date: string) => void)
    | undefined;
  onToggleTask: (id: string, revision: number, done: boolean) => void;
  onOpenTask?: ((id: string) => void) | undefined;
  onCreateTask?: (() => void) | undefined;
  onMoveToday?: ((id: string, direction: -1 | 1) => void) | undefined;
  onOpenNote?: ((id: string) => void) | undefined;
  onStartTimer?: (() => void) | undefined;
  onPauseTimer?: (() => void) | undefined;
  onResumeTimer?: (() => void) | undefined;
  onResetTimer?: (() => void) | undefined;
}) {
  // Production builds leave this unset, and the branch is dropped from the package.
  if (
    import.meta.env.VITE_VENUS_WIDGET_FAULT === "1" &&
    (props.widget.settings.fault === true ||
      props.widget.widgetType === "fault")
  ) {
    throw new Error("widget fault");
  }
  const t = (key: MessageKey) => translate(props.bootstrap.locale, key);
  const kind =
    props.widget.widgetType === "notes"
      ? "note"
      : props.widget.widgetType === "today"
        ? "task"
        : props.widget.widgetType === "upcoming"
          ? "event"
          : props.widget.widgetType === "bookmarks"
            ? "bookmark"
            : null;
  const rows = kind ? props.shared.filter((item) => item.kind === kind) : [];
  if (props.widget.widgetType === "clock") {
    const clock = formatClock(props.now, props.bootstrap);
    return (
      <div>
        <p className="hero-clock" style={{ fontSize: "1.6rem" }}>
          {clock.time}
        </p>
        {clock.dates.map((line) => (
          <p key={line} className="muted">
            {line}
          </p>
        ))}
        <p className="muted">{t("clock.week")}</p>
        <div className="week">
          {weekLabels(props.bootstrap).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    );
  }
  if (props.widget.widgetType === "search") {
    return (
      <form
        className="hero-search"
        style={{ maxWidth: "100%", marginTop: "0.75rem" }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const query = String(data.get("q") ?? "");
          props.onWebSearch(query);
        }}
      >
        <Icon name="search" />
        <input
          id="widget-search"
          name="q"
          type="search"
          aria-label={t("search.label")}
          placeholder={t("search.placeholder")}
        />
        <button className="btn" type="submit">
          {t("search.submit")}
        </button>
        {props.online ? null : <p className="muted">{t("search.offline")}</p>}
      </form>
    );
  }
  if (props.widget.widgetType === "briefing") {
    const today = previewTodayTasks(props.tasks);
    const open = today.filter((task) => task.status !== "done");
    const next = [...props.events].sort(
      (a, b) =>
        a.localDate.year - b.localDate.year ||
        a.localDate.month - b.localDate.month ||
        a.localDate.day - b.localDate.day,
    )[0];
    return (
      <div className="briefing-widget">
        <p className="briefing-lead">
          {open.length
            ? t("briefing.openTasks").replace("{count}", String(open.length))
            : t("briefing.clear")}
        </p>
        {open.slice(0, 3).map((task) => (
          <button
            className="briefing-row"
            key={task.id}
            type="button"
            onClick={() => props.onOpenTask?.(task.id)}
          >
            <span aria-hidden="true">○</span> <bdi>{task.title}</bdi>
          </button>
        ))}
        {next ? (
          <p className="muted briefing-event">
            {t("briefing.nextEvent")}: <bdi>{next.title}</bdi>
          </p>
        ) : (
          <p className="muted">{t("briefing.noEvent")}</p>
        )}
        <button
          className="btn primary"
          type="button"
          onClick={props.onStartTimer}
        >
          {t("briefing.focus")}
        </button>
      </div>
    );
  }
  if (props.widget.widgetType === "capture") {
    return (
      <div className="capture-widget">
        <p className="muted">{t("capture.widgetHint")}</p>
        <div className="cluster">
          <button
            className="btn primary"
            type="button"
            onClick={() => props.onCapture?.("task")}
          >
            {t("capture.task")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => props.onCapture?.("note")}
          >
            {t("capture.noteKind")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => props.onCapture?.("event")}
          >
            {t("capture.event")}
          </button>
        </div>
      </div>
    );
  }
  if (props.widget.widgetType === "habits") {
    const day = props.now.toISOString().slice(0, 10);
    return (
      <ul className="task-list">
        {props.habits.slice(0, 4).map((h) => (
          <li key={h.id}>
            <button
              className="btn"
              onClick={() => props.onToggleHabit?.(h.id, h.revision, day)}
            >
              {h.checkIns.includes(day) ? "✓" : "○"}
            </button>{" "}
            <bdi>{h.title}</bdi>{" "}
            <small className="muted">{habitStreak(h, day)}</small>
          </li>
        ))}
        {!props.habits.length ? <li className="muted">No habits yet</li> : null}
      </ul>
    );
  }
  if (props.widget.widgetType === "goals") {
    const active = props.goals.filter((goal) => goal.status === "active");
    return (
      <div>
        {active.length === 0 ? (
          <p className="muted">{t("goals.empty")}</p>
        ) : null}
        <ul className="task-list">
          {active.slice(0, 3).map((goal) => (
            <li key={goal.id}>
              <div className="task-progress">
                <bdi>{goal.title}</bdi>
                <strong>{goal.progressSummary.percent}%</strong>
              </div>
              <div className="progress-track" aria-hidden="true">
                <span style={{ width: `${goal.progressSummary.percent}%` }} />
              </div>
              {goal.nextMilestone ? (
                <small className="muted">
                  {t("goals.nextMilestone")}: {goal.nextMilestone.title}
                </small>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (props.widget.widgetType === "notes") {
    const recent = previewNotes(props.notes, 2);
    return (
      <ul className="note-preview-list">
        {recent.length === 0 ? (
          <li className="muted">{t("widget.none")}</li>
        ) : null}
        {recent.map((note) => {
          const snippet = note.body.content
            .map((block) => blockPlain(block))
            .join(" ")
            .trim();
          return (
            <li key={note.id} className="preview-note">
              <button
                type="button"
                className="preview-note-main"
                onClick={() => props.onOpenNote?.(note.id)}
              >
                <strong>
                  <bdi>{note.title || t("notes.untitled")}</bdi>
                </strong>
                {snippet ? (
                  <small>
                    <bdi>{snippet.slice(0, 120)}</bdi>
                  </small>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
  if (props.widget.widgetType === "today") {
    const focus = previewTodayTasks(props.tasks);
    const done = focus.filter((task) => task.status === "done").length;
    const total = focus.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return (
      <div>
        {total > 0 ? (
          <div className="task-progress-block">
            <div className="task-progress">
              <span>
                {done} / {total}
              </span>
              <strong>{percent}%</strong>
            </div>
            <div className="progress-track">
              <span style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}
        <ul className="task-list">
          {focus.length === 0 ? (
            <li className="muted">{t("widget.none")}</li>
          ) : null}
          {focus.map((task, index) => (
            <li
              key={task.id}
              className={`task-row${task.status === "done" ? " done" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={task.title}
                checked={task.status === "done"}
                onChange={(event) =>
                  props.onToggleTask(
                    task.id,
                    task.revision,
                    event.target.checked,
                  )
                }
              />
              <button
                className="task-title-link"
                type="button"
                onClick={() => props.onOpenTask?.(task.id)}
              >
                <bdi>{task.title}</bdi>
              </button>
              {task.today ? (
                <div className="cluster">
                  <button
                    className="btn"
                    type="button"
                    aria-label={t("repair.up")}
                    disabled={index === 0}
                    onClick={() => props.onMoveToday?.(task.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn"
                    type="button"
                    aria-label={t("repair.down")}
                    disabled={index === focus.length - 1}
                    onClick={() => props.onMoveToday?.(task.id, 1)}
                  >
                    ↓
                  </button>
                </div>
              ) : null}
              <button
                className="mini-complete btn"
                type="button"
                onClick={() =>
                  props.onToggleTask(
                    task.id,
                    task.revision,
                    task.status !== "done",
                  )
                }
              >
                {t("widget.complete")}
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn"
          type="button"
          onClick={() => props.onCreateTask?.()}
        >
          {t("command.task")}
        </button>
      </div>
    );
  }
  if (props.widget.widgetType === "upcoming") {
    return (
      <ul className="event-list">
        {props.events.length === 0 ? (
          <li className="muted">{t("notify.empty")}</li>
        ) : null}
        {props.events.slice(0, 8).map((event) => (
          <li key={event.id} className="event-row">
            <span className="event-line" aria-hidden="true" />
            <div>
              <strong>
                <bdi>{event.title}</bdi>
              </strong>
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (props.widget.widgetType === "timer") {
    const remainingMs =
      props.timer?.status === "running" && props.timer.endsAtUTC
        ? Math.max(0, props.timer.endsAtUTC - props.now.getTime())
        : props.timer?.status === "paused"
          ? Math.max(
              0,
              props.timer.durationMs - props.timer.elapsedBeforePauseMs,
            )
          : props.timer?.status === "finished"
            ? 0
            : null;
    const displayMs = remainingMs ?? 25 * 60_000;
    const label = `${Math.floor(displayMs / 60000)
      .toString()
      .padStart(2, "0")}:${Math.floor((displayMs % 60000) / 1000)
      .toString()
      .padStart(2, "0")}`;
    const running = props.timer?.status === "running";
    const paused = props.timer?.status === "paused";
    return (
      <div className="focus-widget">
        <div className="focus-ring" aria-hidden="true">
          <div className="focus-center">✳</div>
        </div>
        <div>
          <div className="tiny-label">DEEP WORK MODE</div>
          <p className="focus-time">{label}</p>
          <p className="muted">
            {props.timer
              ? props.timer.status === "finished"
                ? t("timer.finished")
                : `${props.timer.cycleStep} · ${props.timer.status}`
              : t("timer.none")}
          </p>
          <div className="focus-actions">
            {!props.timer || (!running && !paused) ? (
              <button
                className="btn primary"
                type="button"
                onClick={() => props.onStartTimer?.()}
              >
                <Icon name="play" />
                <span>{t("timer.start")}</span>
              </button>
            ) : null}
            {running ? (
              <button
                className="btn primary"
                type="button"
                onClick={() => props.onPauseTimer?.()}
              >
                <Icon name="pause" />
                <span>{t("timer.pause")}</span>
              </button>
            ) : null}
            {paused ? (
              <button
                className="btn primary"
                type="button"
                onClick={() => props.onResumeTimer?.()}
              >
                <Icon name="play" />
                <span>{t("timer.resume")}</span>
              </button>
            ) : null}
            {props.timer ? (
              <button
                className="btn"
                type="button"
                onClick={() => props.onResetTimer?.()}
              >
                {t("timer.reset")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  if (props.widget.widgetType === "bookmarks") {
    const quick = previewQuickLinks(props.bookmarks);
    return (
      <div className="quick-links">
        {quick.length === 0 ? (
          <p className="muted">{t("widget.none")}</p>
        ) : null}
        {quick.map((bookmark) => (
          <a
            key={bookmark.id}
            className="quick-link"
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="link-initial">
              <bdi>{iconFallback(bookmark.title, bookmark.iconLabel)}</bdi>
            </span>
            <span className="link-label">
              <bdi>{bookmark.title}</bdi>
            </span>
          </a>
        ))}
      </div>
    );
  }
  return (
    <div>
      <p className="muted">{t("widget.shared")}</p>
      {rows.length === 0 ? <p>{t("widget.empty")}</p> : null}
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <bdi>{row.title}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BoundaryProps {
  widgetId: string;
  locale: Bootstrap["locale"];
  onReset: () => void;
  onDisable: () => void;
  onCrash?: () => void;
  children: ReactNode;
}
interface BoundaryState {
  failed: boolean;
}
export class WidgetBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onCrash?.();
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    const t = (key: MessageKey) => translate(this.props.locale, key);
    return (
      <div role="alert">
        <p className="error">{t("widget.broken")}</p>
        <button className="btn" type="button" onClick={this.props.onReset}>
          {t("widget.recover")}
        </button>
        <button className="btn" type="button" onClick={this.props.onDisable}>
          {t("widget.disable")}
        </button>
      </div>
    );
  }
}
