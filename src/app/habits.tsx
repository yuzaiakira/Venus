import { useEffect, useState } from "react";
import type { Productivity } from "../application/productivity";
import type { createCalendar } from "../application/calendar";
import { translate } from "../locales/messages";
import {
  habitBestStreak,
  habitState,
  habitStreak,
  type HabitRecord,
} from "../domain/productivity";

export function HabitsScreen(props: {
  habits: HabitRecord[];
  productivity: Productivity;
  locale: "en" | "fa";
  calendar: ReturnType<typeof createCalendar>;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  requestNotificationPermission: () => Promise<string>;
  focusHabitId: string | null;
}) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<
    "granted" | "denied" | "missing" | "error"
  >("missing");
  useEffect(() => {
    let active = true;
    void props.calendar
      .notificationPermission()
      .then((state) => {
        if (active) setPermission(state);
      })
      .catch(() => {
        if (active) setPermission("error");
      });
    return () => {
      active = false;
    };
  }, [props.calendar]);
  useEffect(() => {
    if (!props.focusHabitId) return;
    document
      .getElementById(`habit-${props.focusHabitId}`)
      ?.scrollIntoView({ block: "center" });
  }, [props.focusHabitId, props.habits]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: props.timeZone,
  }).format(new Date());
  const save = async () => {
    try {
      await props.productivity.createHabit(title, frequency);
      await props.onChanged();
      setTitle("");
      setError("");
    } catch {
      setError(translate(props.locale, "settings.error"));
    }
  };
  return (
    <section className="content-card module">
      <div className="page-header">
        <h1>{props.locale === "fa" ? "پیگیری عادت‌ها" : "Habit tracker"}</h1>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {translate(props.locale, "habits.offline")}
        </p>
      ) : null}
      <div className="cluster" role="status">
        <span>
          {permission === "error"
            ? translate(props.locale, "settings.error")
            : translate(
                props.locale,
                permission === "granted"
                  ? "habits.permissionGranted"
                  : permission === "denied"
                    ? "habits.permissionDenied"
                    : "habits.permissionMissing",
              )}
        </span>
        {permission !== "granted" ? (
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props
                .requestNotificationPermission()
                .then(async (outcome) => {
                  const state = await props.calendar.notificationPermission();
                  setPermission(outcome === "denied" ? "denied" : state);
                  if (outcome === "failed" || outcome === "unsupported")
                    setPermission("error");
                })
                .catch(() => setPermission("error"))
            }
          >
            {translate(props.locale, "habits.permissionAction")}
          </button>
        ) : null}
      </div>
      <form
        className="cluster"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <input
          className="field"
          value={title}
          aria-label={props.locale === "fa" ? "نام عادت" : "Habit name"}
          placeholder={props.locale === "fa" ? "نام عادت" : "Habit name"}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="select"
          value={frequency}
          aria-label={props.locale === "fa" ? "برنامه عادت" : "Habit schedule"}
          onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
        >
          <option value="daily">
            {props.locale === "fa" ? "روزانه" : "Daily"}
          </option>
          <option value="weekly">
            {props.locale === "fa" ? "هفتگی" : "Weekly"}
          </option>
        </select>
        <button className="btn primary" disabled={!title.trim()}>
          {props.locale === "fa" ? "افزودن" : "Add habit"}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <ul className="board-cards">
        {props.habits.map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            today={today}
            productivity={props.productivity}
            calendar={props.calendar}
            locale={props.locale}
            onChanged={props.onChanged}
            timeZone={props.timeZone}
          />
        ))}
      </ul>
      {!props.habits.length ? (
        <p className="muted">
          {props.locale === "fa" ? "هنوز عادتی نداری." : "No habits yet."}
        </p>
      ) : null}
    </section>
  );
}
function HabitRow(props: {
  habit: HabitRecord;
  today: string;
  productivity: Productivity;
  locale: "en" | "fa";
  calendar: ReturnType<typeof createCalendar>;
  onChanged: () => Promise<void>;
  timeZone: string;
}) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(props.habit.title);
  const [frequency, setFrequency] = useState(props.habit.frequency);
  const done = props.habit.checkIns.includes(props.today);
  const [enabled, setEnabled] = useState(
    props.habit.reminder?.enabled ?? false,
  );
  const [time, setTime] = useState(props.habit.reminder?.time ?? "09:00");
  const [zone, setZone] = useState(
    props.habit.reminder?.timeZone ?? props.timeZone,
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    props.habit.reminder?.weekdays ?? [],
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  useEffect(() => {
    setFrequency(props.habit.frequency);
    setEnabled(props.habit.reminder?.enabled ?? false);
    setTime(props.habit.reminder?.time ?? "09:00");
    setZone(props.habit.reminder?.timeZone ?? props.timeZone);
    setWeekdays(props.habit.reminder?.weekdays ?? []);
  }, [props.habit.id, props.habit.revision, props.timeZone]);
  const saveReminder = async () => {
    setSaveState("saving");
    try {
      await props.calendar.configureHabitReminder(
        props.habit.id,
        props.habit.revision,
        { enabled, time, timeZone: zone, weekdays },
      );
      setSaveState("saved");
      await props.onChanged();
    } catch {
      setSaveState("error");
    }
  };
  return (
    <li id={`habit-${props.habit.id}`} className="task-card card-glass">
      <strong>{props.habit.title}</strong>
      <span className="muted">
        {props.habit.frequency} · {habitState(props.habit, props.today)} ·{" "}
        {habitStreak(props.habit, props.today)} / {habitBestStreak(props.habit)}{" "}
        {props.locale === "fa" ? "روز" : "streak"}
      </span>
      <small className="muted">
        {props.habit.checkIns.length
          ? props.habit.checkIns.slice(-7).reverse().join(" · ")
          : "No check-ins yet"}
      </small>
      <fieldset className="task-editor">
        <legend>{props.locale === "fa" ? "یادآور" : "Reminder"}</legend>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {props.locale === "fa" ? "فعال‌سازی یادآور" : "Enable reminder"}
        </label>
        <label>
          {props.locale === "fa" ? "زمان" : "Time"}
          <input
            className="field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          {props.locale === "fa" ? "منطقه زمانی" : "Timezone"}
          <input
            className="field"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </label>
        {props.habit.frequency === "weekly" ? (
          <div
            className="cluster"
            aria-label={
              props.locale === "fa" ? "روزهای یادآور" : "Reminder weekdays"
            }
          >
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <label key={day}>
                <input
                  type="checkbox"
                  checked={weekdays.includes(day)}
                  onChange={(e) =>
                    setWeekdays((current) =>
                      e.target.checked
                        ? [...current, day].sort()
                        : current.filter((item) => item !== day),
                    )
                  }
                />
                {props.locale === "fa"
                  ? ["", "د", "س", "چ", "پ", "ج", "ش", "ی"][day]
                  : ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day]}
              </label>
            ))}
          </div>
        ) : null}
        <button
          className="btn"
          type="button"
          disabled={
            saveState === "saving" ||
            (enabled &&
              props.habit.frequency === "weekly" &&
              weekdays.length === 0)
          }
          onClick={() => void saveReminder()}
        >
          {props.locale === "fa" ? "ذخیره یادآور" : "Save reminder"}
        </button>
        <small role="status">
          {saveState === "saved"
            ? props.locale === "fa"
              ? "ذخیره شد"
              : "Saved"
            : saveState === "error"
              ? props.locale === "fa"
                ? "ذخیره ناموفق بود"
                : "Could not save reminder"
              : saveState === "saving"
                ? props.locale === "fa"
                  ? "در حال ذخیره"
                  : "Saving"
                : ""}
        </small>
      </fieldset>
      {edit ? (
        <div className="cluster">
          <input
            className="field"
            value={title}
            aria-label={props.locale === "fa" ? "نام عادت" : "Habit name"}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="select"
            value={frequency}
            aria-label={
              props.locale === "fa" ? "برنامه عادت" : "Habit schedule"
            }
            onChange={(event) =>
              setFrequency(event.target.value as "daily" | "weekly")
            }
          >
            <option value="daily">
              {props.locale === "fa" ? "روزانه" : "Daily"}
            </option>
            <option value="weekly">
              {props.locale === "fa" ? "هفتگی" : "Weekly"}
            </option>
          </select>
          <button
            className="btn"
            disabled={saveState === "saving"}
            onClick={() => {
              setSaveState("saving");
              void props.calendar
                .updateHabit(props.habit.id, props.habit.revision, {
                  title,
                  frequency,
                })
                .then(props.onChanged)
                .then(() => {
                  setSaveState("saved");
                  setEdit(false);
                })
                .catch(() => setSaveState("error"));
            }}
          >
            {props.locale === "fa" ? "ذخیره" : "Save"}
          </button>
        </div>
      ) : null}
      <div className="cluster">
        <button
          className="btn primary"
          onClick={() => {
            setSaveState("saving");
            void props.productivity
              .toggleHabit(props.habit.id, props.habit.revision, props.today)
              .then(props.onChanged)
              .then(() => setSaveState("idle"))
              .catch(() => setSaveState("error"));
          }}
        >
          {done
            ? props.locale === "fa"
              ? "بازگردانی"
              : "Undo"
            : props.locale === "fa"
              ? "انجام شد"
              : "Complete"}
        </button>
        <button className="btn" onClick={() => setEdit(!edit)}>
          {props.locale === "fa" ? "ویرایش" : "Edit"}
        </button>
        <button
          className="btn"
          onClick={() => {
            if (
              confirm(
                props.locale === "fa"
                  ? "این عادت حذف شود؟"
                  : "Delete this habit?",
              )
            )
              void props.calendar
                .deleteHabit(props.habit.id, props.habit.revision)
                .then(props.onChanged)
                .catch(() => setSaveState("error"));
          }}
        >
          {props.locale === "fa" ? "حذف" : "Delete"}
        </button>
      </div>
    </li>
  );
}
