import { useState } from "react";
import type { Focus } from "../application/focus";
import type { createCalendar } from "../application/calendar";
import type {
  FocusConflict,
  FocusSlot,
  FocusSuggestion,
  FocusWorkspace,
} from "../domain/focus";
import { translate, type MessageKey } from "../locales/messages";
import { Icon } from "./icons";

type Locale = "en" | "fa";

function displayTime(value: number, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-u-nu-arabext" : "en", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function displayWindow(slot: FocusSlot, locale: Locale, timeZone: string) {
  return `${displayTime(slot.startAtUTC, locale, timeZone)} – ${displayTime(
    slot.endAtUTC,
    locale,
    timeZone,
  )}`;
}

export function FocusScreen(props: {
  profileId: string;
  data: FocusWorkspace;
  focus: Focus;
  calendar: ReturnType<typeof createCalendar>;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  onOpenTask: (id: string) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(work: () => Promise<unknown>, noticeKey = "focus.saved") {
    setBusy(true);
    setError("");
    try {
      await work();
      await props.onChanged();
      setNotice(t(noticeKey as MessageKey));
    } catch {
      setError(t("focus.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="content-card module" aria-labelledby="focus-heading">
      <div className="page-header">
        <div>
          <h1 id="focus-heading">{t("focus.heading")}</h1>
          <p className="muted">{t("focus.intro")}</p>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("focus.offline")}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" role="status">
          {notice}
        </p>
      ) : null}
      <section className="task-card card-glass" aria-labelledby="focus-plan">
        <div className="page-header">
          <div>
            <h2 id="focus-plan">{t("focus.recommendations")}</h2>
            <p className="muted">{t("focus.calendarRule")}</p>
          </div>
          {props.data.deferredCount ? (
            <span className="muted">
              {t("focus.deferredCount").replace(
                "{count}",
                String(props.data.deferredCount),
              )}
            </span>
          ) : null}
        </div>
        {props.data.activeTimer ? (
          <ActiveTimer
            active={props.data.activeTimer}
            locale={props.locale}
            onPause={() =>
              void run(() =>
                props.calendar.pauseTimer(props.data.activeTimer!.id),
              )
            }
            onResume={() =>
              void run(() =>
                props.calendar.resumeTimer(props.data.activeTimer!.id),
              )
            }
            onReset={() =>
              void run(() =>
                props.calendar.resetTimer(props.data.activeTimer!.id),
              )
            }
            busy={busy}
          />
        ) : null}
        {!props.data.suggestions.length ? (
          <p className="muted">{t("focus.empty")}</p>
        ) : null}
        <div className="board-cards" aria-live="polite">
          {props.data.suggestions.map((suggestion) => (
            <FocusCard
              key={suggestion.task.id}
              suggestion={suggestion}
              locale={props.locale}
              timeZone={props.timeZone}
              busy={busy || Boolean(props.data.activeTimer)}
              onOpen={() => props.onOpenTask(suggestion.task.id)}
              onStart={() =>
                void run(
                  () =>
                    props.calendar.startTimer({
                      mode: "pomodoro",
                      label: suggestion.task.title,
                      durationMs:
                        (suggestion.slot?.durationMinutes ?? 25) * 60_000,
                    }),
                  "focus.started",
                )
              }
              onSnooze={() =>
                void run(() =>
                  props.focus.snooze(
                    props.profileId,
                    suggestion.task.id,
                    suggestion.stateRevision,
                    60,
                  ),
                )
              }
              onDefer={() =>
                void run(() =>
                  props.focus.defer(
                    props.profileId,
                    suggestion.task.id,
                    suggestion.stateRevision,
                    props.data.today,
                  ),
                )
              }
            />
          ))}
        </div>
      </section>
      <section className="task-card card-glass" aria-labelledby="focus-windows">
        <h2 id="focus-windows">{t("focus.windows")}</h2>
        {props.data.slots.length ? (
          <ul className="task-list">
            {props.data.slots.map((slot) => (
              <li key={slot.startAtUTC}>
                {displayWindow(slot, props.locale, props.timeZone)} ·{" "}
                {slot.durationMinutes} {t("focus.minutes")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t("focus.noWindow")}</p>
        )}
      </section>
      <section
        className="task-card card-glass"
        aria-labelledby="focus-conflicts"
      >
        <h2 id="focus-conflicts">{t("focus.conflicts")}</h2>
        {!props.data.conflicts.length ? (
          <p className="muted">{t("focus.noConflicts")}</p>
        ) : (
          <ul className="task-list">
            {props.data.conflicts.slice(0, 8).map((conflict) => (
              <ConflictRow
                key={`${conflict.title}:${conflict.startAtUTC}`}
                conflict={conflict}
                locale={props.locale}
                timeZone={props.timeZone}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function FocusCard(props: {
  suggestion: FocusSuggestion;
  locale: Locale;
  timeZone: string;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
  onSnooze: () => void;
  onDefer: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  return (
    <article className="task-card card-glass">
      <p className="tiny-label">
        {t(`focus.reason.${props.suggestion.reason}` as MessageKey)}
      </p>
      <button className="task-title-link" type="button" onClick={props.onOpen}>
        <bdi>{props.suggestion.task.title}</bdi>
      </button>
      {props.suggestion.slot ? (
        <p className="muted">
          {t("focus.nextWindow")}:{" "}
          {displayWindow(props.suggestion.slot, props.locale, props.timeZone)}
        </p>
      ) : (
        <p className="muted">{t("focus.noWindow")}</p>
      )}
      <div className="cluster">
        <button
          className="btn primary"
          type="button"
          disabled={props.busy}
          onClick={props.onStart}
        >
          <Icon name="play" /> {t("focus.start")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onSnooze}
        >
          {t("focus.snooze")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onDefer}
        >
          {t("focus.defer")}
        </button>
      </div>
    </article>
  );
}

function ActiveTimer(props: {
  active: NonNullable<FocusWorkspace["activeTimer"]>;
  locale: Locale;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  if (!props.active) return null;
  return (
    <div className="focus-widget" role="status">
      <div>
        <p className="briefing-lead">{t("focus.timerActive")}</p>
        {props.active.label ? (
          <p>
            <bdi>{props.active.label}</bdi>
          </p>
        ) : null}
      </div>
      <div className="cluster">
        {props.active.status === "running" ? (
          <button
            className="btn primary"
            type="button"
            disabled={props.busy}
            onClick={props.onPause}
          >
            {t("timer.pause")}
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            disabled={props.busy}
            onClick={props.onResume}
          >
            {t("timer.resume")}
          </button>
        )}
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onReset}
        >
          {t("timer.reset")}
        </button>
      </div>
    </div>
  );
}

function ConflictRow(props: {
  conflict: FocusConflict;
  locale: Locale;
  timeZone: string;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  return (
    <li>
      <bdi>{props.conflict.title}</bdi>
      <small className="muted">
        {props.conflict.allDay
          ? t("focus.allDay")
          : `${displayTime(props.conflict.startAtUTC, props.locale, props.timeZone)} – ${displayTime(props.conflict.endAtUTC, props.locale, props.timeZone)}`}
      </small>
    </li>
  );
}
