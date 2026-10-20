import { useEffect, useState } from "react";
import type { createCalendar } from "../application/calendar";
import type { Bootstrap } from "../domain/dashboard";
import { formatNumber } from "../domain/dashboard";
import {
  addMonths,
  convertDate,
  formatCalendarDate,
  isoWeekday,
  monthLength,
  todayInZone,
  type CalendarBasis,
  type CalendarDate,
} from "../domain/time/calendar";
import type { EventRecord } from "../domain/time/records";
import { recurrenceFromForm } from "../domain/time/form";
import type { Occurrence } from "../domain/time/recurrence";
import { translate, type MessageKey } from "../locales/messages";

type CalendarApi = ReturnType<typeof createCalendar>;

export function CalendarPanel(props: {
  bootstrap: Bootstrap;
  events: EventRecord[];
  calendar: CalendarApi;
  onChanged: () => Promise<void>;
}) {
  const locale = props.bootstrap.locale;
  const t = (key: MessageKey) => translate(locale, key);
  const display: CalendarBasis =
    props.bootstrap.calendarDisplay === "jalali" ? "jalali" : "gregorian";
  const [cursor, setCursor] = useState<CalendarDate>(() =>
    todayInZone(props.bootstrap.timeZone, Date.now(), display),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneId, setZoneId] = useState(props.bootstrap.timeZone);
  const [minute, setMinute] = useState(0);
  const [untilText, setUntilText] = useState("");
  const [basis, setBasis] = useState<CalendarBasis>(display);
  const [allDay, setAllDay] = useState(true);
  const [freq, setFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">(
    "WEEKLY",
  );
  const [repeat, setRepeat] = useState(false);
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [ordinal, setOrdinal] = useState<"none" | "-1" | "1" | "2" | "3" | "4">(
    "none",
  );
  const [ordinalWeekday, setOrdinalWeekday] = useState(4);
  const [bound, setBound] = useState<"none" | "count" | "until">("none");
  const [count, setCount] = useState(4);
  const [invalidDay, setInvalidDay] = useState<"skip" | "last_day">("skip");
  const [offset, setOffset] = useState(15);
  const [absolute, setAbsolute] = useState("");
  const [important, setImportant] = useState(false);
  const [fold, setFold] = useState<"earlier" | "later">("earlier");
  const [hour, setHour] = useState(9);
  const [generated, setGenerated] = useState<Occurrence[]>([]);
  const [status, setStatus] = useState("");
  const numerals = (value: number) => formatNumber(value, props.bootstrap);
  const length = monthLength(cursor);
  const firstWeekday = isoWeekday({ ...cursor, day: 1 });
  const weekStart =
    props.bootstrap.weekStart === 0 ? 7 : props.bootstrap.weekStart;
  const leading = (firstWeekday - weekStart + 7) % 7;
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length }, (_item, index) => index + 1),
  ];
  const current = props.events.find((event) => event.id === selected) ?? null;
  useEffect(() => {
    setCursor((date) => convertDate(date, display));
  }, [display]);
  useEffect(() => {
    const event = props.events.find((row) => row.id === selected);
    if (!event) return;
    setTitle(event.title);
    setDescription(event.description);
    setZoneId(event.zoneId);
    setAllDay(event.allDay);
    setHour(event.wall?.hour ?? 9);
    setMinute(event.wall?.minute ?? 0);
    setBasis(event.calendarBasis);
    setCursor(convertDate(event.localDate, display));
    setFold(event.foldPolicy);
    const rule = event.recurrenceSpec;
    setRepeat(!!rule);
    setFreq(rule?.freq ?? "WEEKLY");
    setInterval(rule?.interval ?? 1);
    setWeekdays(rule?.byWeekdays ?? []);
    setOrdinal(
      rule?.ordinalWeekday
        ? (String(rule.ordinalWeekday.ordinal) as typeof ordinal)
        : "none",
    );
    setOrdinalWeekday(rule?.ordinalWeekday?.weekday ?? 4);
    setBound(rule?.count ? "count" : rule?.untilLocalDate ? "until" : "none");
    setCount(rule?.count ?? 4);
    setInvalidDay(rule?.invalidDayPolicy ?? "skip");
    const until = rule?.untilLocalDate;
    setUntilText(
      until
        ? `${until.year}-${String(until.month).padStart(2, "0")}-${String(until.day).padStart(2, "0")}`
        : "",
    );
    let active = true;
    void props.calendar
      .list()
      .then((schedule) => {
        if (!active) return;
        const rules = schedule.rules.filter((row) => row.eventId === event.id);
        const relative = rules.find((row) => row.offsetMinutes !== null);
        setOffset(relative?.offsetMinutes ?? 15);
        setImportant(relative?.quietHoursOverride ?? false);
        const absolute = rules.find((row) => row.absoluteTime !== null);
        setAbsolute(
          absolute?.absoluteTime
            ? new Date(absolute.absoluteTime).toISOString()
            : "",
        );
      })
      .catch(() => setStatus(t("calendar.failed")));
    return () => {
      active = false;
    };
  }, [selected]);
  useEffect(() => {
    if (!current) {
      setGenerated([]);
      return;
    }
    void props.calendar
      .occurrences(current.id)
      .then(setGenerated)
      .catch(() => setStatus(t("calendar.failed")));
  }, [current, props.calendar]);
  function draftSpec() {
    const calendar = current ? current.calendarBasis : basis;
    const pieces = untilText.split("-").map(Number);
    if (
      bound === "until" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(untilText) || pieces.length !== 3)
    )
      throw new Error("invalidInput");
    return recurrenceFromForm({
      enabled: repeat,
      basis: current ? current.calendarBasis : basis,
      freq,
      interval,
      weekdays,
      ordinal,
      ordinalWeekday,
      monthDay: null,
      count: bound === "count" ? count : null,
      until:
        bound === "until"
          ? { calendar, year: pieces[0]!, month: pieces[1]!, day: pieces[2]! }
          : null,
      invalidDayPolicy: invalidDay,
      startDate: convertDate(cursor, calendar),
      wall: allDay ? null : { hour, minute, second: 0 },
      timeZone: zoneId,
      foldPolicy: fold,
      wkst: props.bootstrap.weekStart === 0 ? 7 : props.bootstrap.weekStart,
    });
  }
  async function create() {
    setStatus("");
    const recurrence = draftSpec();
    await props.calendar.createEvent({
      title,
      basis,
      allDay,
      localDate: convertDate({ ...cursor, calendar: display }, basis),
      wall: allDay ? null : { hour, minute, second: 0 },
      zoneId,
      description,
      recurrence,
      foldPolicy: fold,
      reminders: remindersFromForm(),
    });
    setTitle("");
    setStatus(t("calendar.saved"));
    await props.onChanged();
  }
  function remindersFromForm() {
    const rows: Array<{
      offsetMinutes: number | null;
      absoluteTime: number | null;
      quietHoursOverride: boolean;
    }> = [
      {
        offsetMinutes: offset,
        absoluteTime: null,
        quietHoursOverride: important,
      },
    ];
    if (absolute) {
      const parsed = Date.parse(absolute);
      if (Number.isFinite(parsed))
        rows.push({
          offsetMinutes: null,
          absoluteTime: parsed,
          quietHoursOverride: important,
        });
    }
    return rows;
  }
  async function saveSeries() {
    if (!current) return;
    const saved = await props.calendar.saveEvent(current.id, current.revision, {
      title,
      description,
      zoneId,
      localDate: convertDate(cursor, current.calendarBasis),
      allDay,
      wall: allDay ? null : { hour, minute, second: 0 },
      foldPolicy: fold,
      recurrenceSpec: draftSpec(),
    });
    await props.calendar.replaceRules(
      saved.id,
      saved.revision,
      remindersFromForm(),
    );
    setStatus(t("calendar.saved"));
    await props.onChanged();
  }
  async function editOccurrence(key: string) {
    if (!current) return;
    await props.calendar.saveEvent(
      current.id,
      current.revision,
      { title },
      "THIS",
      key,
    );
    setStatus(t("calendar.saved"));
    await props.onChanged();
  }
  async function skipOccurrence(key: string) {
    if (!current) return;
    await props.calendar.saveEvent(
      current.id,
      current.revision,
      { exclusions: [key] },
      "THIS",
      key,
    );
    setStatus(t("calendar.saved"));
    await props.onChanged();
  }
  return (
    <section className="glass" aria-label={t("calendar.heading")}>
      <h2>{t("calendar.heading")}</h2>
      <p className="muted">{t("calendar.closedBrowser")}</p>
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
        >
          {t("calendar.prev")}
        </button>
        <p>{formatCalendarDate(cursor, locale, numerals)}</p>
        <button
          className="btn"
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
        >
          {t("calendar.next")}
        </button>
      </div>
      <div className="week">
        {cells.map((day, index) => (
          <button
            key={`${cursor.year}-${cursor.month}-${index}`}
            className="btn"
            type="button"
            disabled={day === null}
            onClick={() => day && setCursor({ ...cursor, day })}
          >
            {day === null ? "" : numerals(day)}
          </button>
        ))}
      </div>
      <h3>{t("calendar.agenda")}</h3>
      <ul>
        {props.events
          .filter((event) => sameMonth(event, cursor))
          .map((event) => (
            <li key={event.id}>
              <button
                className="btn"
                type="button"
                onClick={() => setSelected(event.id)}
              >
                <bdi>{event.title}</bdi>
              </button>
              <span className="muted">
                {formatCalendarDate(event.localDate, locale, numerals)}
                {event.recurrenceSpec ? ` · ${event.recurrenceSpec.basis}` : ""}
              </span>
            </li>
          ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void (current ? saveSeries() : create()).catch(() =>
            setStatus(t("calendar.failed")),
          );
        }}
      >
        <label>
          {t("capture.title")}
          <input
            className="field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t("capture.details")}
          <textarea
            className="field"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label>
          {t("settings.zone")}
          <input
            className="field"
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
          />
        </label>
        <label>
          {t("calendar.basis")}
          <select
            className="field"
            value={current ? current.calendarBasis : basis}
            disabled={current !== null}
            onChange={(event) =>
              setBasis(event.target.value === "jalali" ? "jalali" : "gregorian")
            }
          >
            <option value="gregorian">{t("calendar.gregorian")}</option>
            <option value="jalali">{t("calendar.jalali")}</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
          />
          {t("calendar.allDay")}
        </label>
        <label>
          {t("calendar.invalidDay")}
          <select
            className="field"
            value={invalidDay}
            onChange={(event) =>
              setInvalidDay(
                event.target.value === "last_day" ? "last_day" : "skip",
              )
            }
          >
            <option value="skip">{t("calendar.skip")}</option>
            <option value="last_day">{t("calendar.lastDay")}</option>
          </select>
        </label>
        <label>
          {t("calendar.reminder")}
          <input
            className="field"
            type="number"
            min={0}
            value={offset}
            onChange={(event) => setOffset(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={repeat}
            onChange={(event) => setRepeat(event.target.checked)}
          />
          {t("calendar.repeat")}
        </label>
        <label>
          {t("calendar.interval")}
          <input
            className="field"
            type="number"
            min={1}
            value={interval}
            onChange={(event) => setInterval(Number(event.target.value))}
          />
        </label>
        <label>
          {t("calendar.repeat")}
          <select
            className="field"
            value={freq}
            onChange={(event) => setFreq(event.target.value as typeof freq)}
          >
            <option value="DAILY">{t("calendar.daily")}</option>
            <option value="WEEKLY">{t("calendar.weekly")}</option>
            <option value="MONTHLY">{t("calendar.monthly")}</option>
            <option value="YEARLY">{t("calendar.yearly")}</option>
          </select>
        </label>
        <fieldset>
          <legend>{t("calendar.weekdays")}</legend>
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={weekdays.includes(day)}
                onChange={(event) =>
                  setWeekdays(
                    event.target.checked
                      ? [...weekdays, day]
                      : weekdays.filter((item) => item !== day),
                  )
                }
              />
              {day}
            </label>
          ))}
        </fieldset>
        <label>
          {t("calendar.ordinal")}
          <select
            className="field"
            value={ordinal}
            onChange={(event) =>
              setOrdinal(event.target.value as typeof ordinal)
            }
          >
            <option value="none">{t("calendar.once")}</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="-1">{t("calendar.last")}</option>
          </select>
        </label>
        <label>
          {t("calendar.ordinalDay")}
          <input
            className="field"
            type="number"
            min={1}
            max={7}
            value={ordinalWeekday}
            onChange={(event) => setOrdinalWeekday(Number(event.target.value))}
          />
        </label>
        <label>
          {t("calendar.bound")}
          <select
            className="field"
            value={bound}
            onChange={(event) => setBound(event.target.value as typeof bound)}
          >
            <option value="none">{t("calendar.once")}</option>
            <option value="count">{t("calendar.count")}</option>
            <option value="until">{t("calendar.until")}</option>
          </select>
        </label>
        <label>
          {t("calendar.count")}
          <input
            className="field"
            type="number"
            min={1}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
        </label>
        <label>
          {t("calendar.hour")}
          <input
            className="field"
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
          />
        </label>
        <label>
          {t("calendar.minute")}
          <input
            className="field"
            type="number"
            min="0"
            max="59"
            value={minute}
            onChange={(event) => setMinute(Number(event.target.value))}
          />
        </label>
        {bound === "until" ? (
          <label>
            {t("calendar.untilDate")}
            <input
              className="field"
              placeholder="YYYY-MM-DD"
              value={untilText}
              onChange={(event) => setUntilText(event.target.value)}
            />
          </label>
        ) : null}
        <label>
          {t("calendar.fold")}
          <select
            className="field"
            value={fold}
            onChange={(event) =>
              setFold(event.target.value === "later" ? "later" : "earlier")
            }
          >
            <option value="earlier">{t("calendar.earlier")}</option>
            <option value="later">{t("calendar.later")}</option>
          </select>
        </label>
        <label>
          {t("calendar.absolute")}
          <input
            className="field"
            value={absolute}
            onChange={(event) => setAbsolute(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={important}
            onChange={(event) => setImportant(event.target.checked)}
          />
          {t("calendar.important")}
        </label>
        <button className="btn primary" type="submit">
          {t(current ? "calendar.saveSeries" : "calendar.create")}
        </button>
        {current ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setSelected(null);
              setTitle("");
              setDescription("");
              setRepeat(false);
              setStatus("");
            }}
          >
            {t("calendar.create")}
          </button>
        ) : null}
      </form>
      {generated.some((item) => item.adjusted) ? (
        <p>{t("calendar.adjusted")}</p>
      ) : null}
      <ul>
        {generated.map((item) => (
          <li key={item.key}>
            <span>{item.key}</span>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void editOccurrence(item.key).catch(() =>
                  setStatus(t("calendar.failed")),
                )
              }
            >
              {t("calendar.editThis")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() =>
                void skipOccurrence(item.key).catch(() =>
                  setStatus(t("calendar.failed")),
                )
              }
            >
              {t("calendar.skipOccurrence")}
            </button>
          </li>
        ))}
      </ul>
      {current ? (
        <div>
          <p>
            <bdi>{current.title}</bdi>
          </p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (window.confirm(t("repair.confirmDelete")))
                void props.calendar
                  .deleteEvent(current.id)
                  .then(() => {
                    setSelected(null);
                    setTitle("");
                    return props.onChanged();
                  })
                  .catch(() => setStatus(t("calendar.failed")));
            }}
          >
            {t("calendar.deleteSeries")}
          </button>
        </div>
      ) : null}
      <p role="status">{status}</p>
    </section>
  );
}

function sameMonth(event: EventRecord, cursor: CalendarDate) {
  const shown = convertDate(event.localDate, cursor.calendar);
  return shown.year === cursor.year && shown.month === cursor.month;
}
