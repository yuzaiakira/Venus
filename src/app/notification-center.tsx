import { useState } from "react";
import type { createCalendar } from "../application/calendar";
import type {
  NotificationRecord,
  QuietHoursRecord,
  TimerRecord,
} from "../domain/time/records";
import { translate, type MessageKey } from "../locales/messages";

type CalendarApi = ReturnType<typeof createCalendar>;

export function NotificationCenter(props: {
  locale: "en" | "fa";
  rows: NotificationRecord[];
  quiet: QuietHoursRecord;
  timer: TimerRecord | null;
  calendar: CalendarApi;
  onChanged: () => Promise<void>;
  onOpenHabit: (habitId: string) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [error, setError] = useState("");
  const upcoming = props.rows.filter((row) => row.internalStatus === "pending");
  const open = props.rows.filter((row) =>
    ["due", "missed"].includes(row.internalStatus),
  );
  const history = props.rows.filter((row) =>
    ["dismissed", "completed", "cancelled", "snoozed"].includes(
      row.internalStatus,
    ),
  );
  return (
    <section className="glass menu" aria-live="polite">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <h2>{t("nav.notifications")}</h2>
      <p>{t("calendar.closedBrowser")}</p>
      <p className="muted">{t("notify.unobserved")}</p>
      <h3>{t("notify.upcoming")}</h3>
      <NotificationList
        rows={upcoming}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
        onOpenHabit={props.onOpenHabit}
      />
      <h3>{t("notify.open")}</h3>
      <NotificationList
        rows={open}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
        onOpenHabit={props.onOpenHabit}
      />
      <h3>{t("notify.history")}</h3>
      <NotificationList
        rows={history}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
        onOpenHabit={props.onOpenHabit}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void props.calendar
            .saveQuietHours({
              enabled: data.get("enabled") === "on",
              start: String(data.get("start") ?? "22:00"),
              end: String(data.get("end") ?? "07:00"),
              timeZone: props.quiet.timeZone,
            })
            .then(props.onChanged)
            .catch(() => setError(t("settings.error")));
        }}
      >
        <label>
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={props.quiet.enabled}
          />
          {t("notify.quiet")}
        </label>
        <label>
          {t("notify.quietStart")}
          <input
            className="field"
            name="start"
            defaultValue={props.quiet.start}
          />
        </label>
        <label>
          {t("notify.quietEnd")}
          <input className="field" name="end" defaultValue={props.quiet.end} />
        </label>
        <button className="btn" type="submit">
          {t("notify.saveQuiet")}
        </button>
      </form>
      <TimerControls
        locale={props.locale}
        timer={props.timer}
        calendar={props.calendar}
        onChanged={props.onChanged}
      />
    </section>
  );
}

function NotificationList(props: {
  rows: NotificationRecord[];
  locale: "en" | "fa";
  calendar: CalendarApi;
  onChanged: () => Promise<void>;
  onOpenHabit: (habitId: string) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [error, setError] = useState("");
  if (props.rows.length === 0) return <p>{t("notify.empty")}</p>;
  return (
    <ul>
      {error ? (
        <li className="error" role="alert">
          {error}
        </li>
      ) : null}
      {props.rows.map((row) => (
        <li key={row.idempotencyKey}>
          {row.sourceKind === "habit" ? (
            <button
              className="btn"
              type="button"
              onClick={() => props.onOpenHabit(row.ownerId)}
            >
              {t("habits.openFromReminder")}
            </button>
          ) : null}
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .markRead(row.idempotencyKey)
                .then(props.onChanged)
                .catch(() => setError(t("settings.error")))
            }
          >
            <bdi>{row.title}</bdi>
          </button>
          <span className="muted">
            {row.internalStatus}
            {row.read ? "" : ` · ${t("notify.unread")}`}
            {row.nativeApiStatus ? ` · ${row.nativeApiStatus}` : ""}
            {` · ${t("notify.osUnobserved")}`}
          </span>
          {["pending", "due", "missed"].includes(row.internalStatus) ? (
            <>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.calendar
                    .snooze(row.idempotencyKey, 10)
                    .then(props.onChanged)
                    .catch(() => setError(t("settings.error")))
                }
              >
                {t("notify.snooze")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.calendar
                    .complete(row.idempotencyKey)
                    .then(props.onChanged)
                    .catch(() => setError(t("settings.error")))
                }
              >
                {t("notify.done")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.calendar
                    .dismiss(row.idempotencyKey)
                    .then(props.onChanged)
                    .catch(() => setError(t("settings.error")))
                }
              >
                {t("notify.dismiss")}
              </button>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TimerControls(props: {
  locale: "en" | "fa";
  timer: TimerRecord | null;
  calendar: CalendarApi;
  onChanged: () => Promise<void>;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [mode, setMode] = useState<"pomodoro" | "countdown">("pomodoro");
  const [minutes, setMinutes] = useState(25);
  const [autoNext, setAutoNext] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const remaining =
    props.timer?.status === "running" && props.timer.endsAtUTC
      ? Math.max(0, props.timer.endsAtUTC - Date.now())
      : props.timer?.status === "paused"
        ? Math.max(0, props.timer.durationMs - props.timer.elapsedBeforePauseMs)
        : null;
  async function run(work: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await work();
      await props.onChanged();
    } catch {
      setError(t("settings.error"));
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <h3>{t("timer.heading")}</h3>
      <p>
        {props.timer
          ? `${props.timer.cycleStep} · ${props.timer.status} · ${Math.ceil((remaining ?? 0) / 1000)}s`
          : t("timer.none")}
      </p>
      {props.timer?.clockWarning ? (
        <p className="error" role="alert">
          {t("timer.clockWarning")}
        </p>
      ) : null}
      {!props.timer || !["running", "paused"].includes(props.timer.status) ? (
        <form
          className="cluster"
          onSubmit={(event) => {
            event.preventDefault();
            if (Number.isFinite(minutes) && minutes >= 1 && minutes <= 1440)
              void run(() =>
                props.calendar.startTimer({
                  mode,
                  durationMs: minutes * 60_000,
                  autoNext: mode === "pomodoro" && autoNext,
                }),
              );
          }}
        >
          <label>
            {t("timer.mode")}
            <select
              className="select"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "pomodoro" | "countdown")
              }
            >
              <option value="pomodoro">{t("timer.pomodoro")}</option>
              <option value="countdown">{t("timer.countdown")}</option>
            </select>
          </label>
          <label>
            {t("timer.minutes")}
            <input
              className="field"
              type="number"
              min="1"
              max="1440"
              required
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
          {mode === "pomodoro" ? (
            <label>
              <input
                type="checkbox"
                checked={autoNext}
                onChange={(event) => setAutoNext(event.target.checked)}
              />
              {t("timer.autoNext")}
            </label>
          ) : null}
          <button className="btn primary" type="submit" disabled={pending}>
            {t("timer.start")}
          </button>
        </form>
      ) : (
        <div className="cluster">
          {props.timer.status === "running" ? (
            <button
              className="btn"
              disabled={pending}
              type="button"
              onClick={() =>
                void run(() => props.calendar.pauseTimer(props.timer!.id))
              }
            >
              {t("timer.pause")}
            </button>
          ) : null}
          {props.timer.status === "paused" ? (
            <button
              className="btn"
              disabled={pending}
              type="button"
              onClick={() =>
                void run(() => props.calendar.resumeTimer(props.timer!.id))
              }
            >
              {t("timer.resume")}
            </button>
          ) : null}
          <button
            className="btn"
            disabled={pending}
            type="button"
            onClick={() =>
              void run(() => props.calendar.resetTimer(props.timer!.id))
            }
          >
            {t("timer.reset")}
          </button>
        </div>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
