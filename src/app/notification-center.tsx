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
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
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
      <h2>{t("nav.notifications")}</h2>
      <p>{t("calendar.closedBrowser")}</p>
      <p className="muted">{t("notify.unobserved")}</p>
      <h3>{t("notify.upcoming")}</h3>
      <NotificationList
        rows={upcoming}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
      />
      <h3>{t("notify.open")}</h3>
      <NotificationList
        rows={open}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
      />
      <h3>{t("notify.history")}</h3>
      <NotificationList
        rows={history}
        locale={props.locale}
        calendar={props.calendar}
        onChanged={props.onChanged}
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
            .then(props.onChanged);
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
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  if (props.rows.length === 0) return <p>{t("notify.empty")}</p>;
  return (
    <ul>
      {props.rows.map((row) => (
        <li key={row.idempotencyKey}>
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .markRead(row.idempotencyKey)
                .then(props.onChanged)
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
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .snooze(row.idempotencyKey, 10)
                .then(props.onChanged)
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
            }
          >
            {t("notify.dismiss")}
          </button>
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
  const remaining =
    props.timer?.status === "running" && props.timer.endsAtUTC
      ? Math.max(0, props.timer.endsAtUTC - Date.now())
      : null;
  return (
    <div>
      <h3>{t("timer.heading")}</h3>
      {props.timer ? (
        <p>
          {props.timer.cycleStep} · {props.timer.status}
          {remaining !== null ? ` · ${Math.ceil(remaining / 1000)}s` : ""}
        </p>
      ) : (
        <p>{t("timer.none")}</p>
      )}
      <button
        className="btn"
        type="button"
        onClick={() =>
          void props.calendar
            .startTimer({ mode: "pomodoro", durationMs: 25 * 60_000 })
            .then(props.onChanged)
            .catch(() => undefined)
        }
      >
        {t("timer.start")}
      </button>
      {props.timer ? (
        <>
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .pauseTimer(props.timer!.id)
                .then(props.onChanged)
            }
          >
            {t("timer.pause")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .resumeTimer(props.timer!.id)
                .then(props.onChanged)
            }
          >
            {t("timer.resume")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props.calendar
                .resetTimer(props.timer!.id)
                .then(props.onChanged)
            }
          >
            {t("timer.reset")}
          </button>
        </>
      ) : null}
    </div>
  );
}
