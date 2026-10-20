import { useState } from "react";
import type { Productivity } from "../application/productivity";
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
}) {
  const [title, setTitle] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(new Date());
  const save = async () => {
    try {
      await props.productivity.createHabit(title, frequency);
      setTitle("");
      setError("");
    } catch {
      setError("Could not save habit");
    }
  };
  return (
    <section className="content-card module">
      <div className="page-header">
        <h1>{props.locale === "fa" ? "پیگیری عادت‌ها" : "Habit tracker"}</h1>
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
          placeholder={props.locale === "fa" ? "نام عادت" : "Habit name"}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="select"
          value={frequency}
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
            locale={props.locale}
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
}) {
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(props.habit.title);
  const done = props.habit.checkIns.includes(props.today);
  return (
    <li className="task-card card-glass">
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
      {edit ? (
        <div className="cluster">
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className="btn"
            onClick={() =>
              void props.productivity.updateHabit(
                props.habit.id,
                props.habit.revision,
                { title, frequency: props.habit.frequency },
              )
            }
          >
            Save
          </button>
        </div>
      ) : null}
      <div className="cluster">
        <button
          className="btn primary"
          onClick={() =>
            void props.productivity.toggleHabit(
              props.habit.id,
              props.habit.revision,
              props.today,
            )
          }
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
            if (confirm("Delete habit?"))
              void props.productivity.deleteHabit(
                props.habit.id,
                props.habit.revision,
              );
          }}
        >
          {props.locale === "fa" ? "حذف" : "Delete"}
        </button>
      </div>
    </li>
  );
}
