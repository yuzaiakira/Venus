import { useMemo, useState } from "react";
import type {
  ReviewEntry,
  Reviews,
  ReviewsWorkspace,
} from "../application/reviews";
import type { ReviewRating } from "../domain/reviews";
import { plainText } from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
function displayDate(value: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-u-nu-arabext" : "en", {
    timeZone,
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function ReviewsScreen(props: {
  profileId: string;
  data: ReviewsWorkspace;
  reviews: Reviews;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  onOpenNote: (id: string) => void;
}) {
  const t = (key: MessageKey, values?: Record<string, string>) =>
    translate(props.locale, key, values);
  const [noteId, setNoteId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const today = localDate(props.timeZone);
  const queue = useMemo(
    () => [...props.data.overdue, ...props.data.due],
    [props.data.due, props.data.overdue],
  );
  const next = queue[0] ?? null;
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      await props.onChanged();
      setError("");
    } catch {
      setError(t("reviews.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card module" aria-labelledby="reviews-heading">
      <div className="page-header">
        <div>
          <h1 id="reviews-heading">{t("reviews.heading")}</h1>
          <p className="muted">{t("reviews.intro")}</p>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("reviews.offline")}
        </p>
      ) : null}
      <section
        className="task-card card-glass"
        aria-labelledby="reviews-enroll"
      >
        <h2 id="reviews-enroll">{t("reviews.enroll")}</h2>
        {props.data.eligibleNotes.length ? (
          <div className="cluster">
            <label>
              {t("reviews.selectNote")}
              <select
                className="select"
                aria-label={t("reviews.selectNote")}
                value={noteId}
                onChange={(event) => setNoteId(event.target.value)}
              >
                <option value="">{t("reviews.chooseNote")}</option>
                {props.data.eligibleNotes.map((note) => (
                  <option key={note.id} value={note.id}>
                    {note.title || t("notes.untitled")}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn primary"
              type="button"
              disabled={!noteId || busy}
              onClick={() =>
                void run(async () => {
                  await props.reviews.enroll(props.profileId, noteId, today);
                  setNoteId("");
                })
              }
            >
              {t("reviews.add")}
            </button>
          </div>
        ) : (
          <p className="muted">{t("reviews.noEligibleNotes")}</p>
        )}
      </section>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <section
        className="task-card card-glass"
        aria-live="polite"
        aria-labelledby="reviews-queue"
      >
        <div className="page-header">
          <h2 id="reviews-queue">
            {t("reviews.dueToday", { count: String(queue.length) })}
          </h2>
          <span className="muted">
            {t("reviews.completedToday", {
              count: String(props.data.completedToday.length),
            })}
          </span>
        </div>
        {next ? (
          <ReviewCard
            entry={next}
            locale={props.locale}
            timeZone={props.timeZone}
            busy={busy}
            onOpen={() => props.onOpenNote(next.noteId)}
            onRate={(rating) =>
              run(() =>
                props.reviews.submitRating(
                  next.id,
                  next.revision,
                  rating,
                  today,
                ),
              )
            }
            onPostpone={() =>
              run(() => props.reviews.postpone(next.id, next.revision, today))
            }
            onPause={() =>
              run(() => props.reviews.pause(next.id, next.revision))
            }
            onRemove={() =>
              run(() => props.reviews.remove(next.id, next.revision))
            }
          />
        ) : (
          <p className="muted">{t("reviews.queueEmpty")}</p>
        )}
      </section>
      <section
        className="task-card card-glass"
        aria-labelledby="reviews-upcoming"
      >
        <h2 id="reviews-upcoming">{t("reviews.upcoming")}</h2>
        {!props.data.upcoming.length ? (
          <p className="muted">{t("reviews.noUpcoming")}</p>
        ) : null}
        <ul className="task-list">
          {props.data.upcoming.slice(0, 8).map((entry) => (
            <ReviewRow
              key={entry.id}
              entry={entry}
              locale={props.locale}
              timeZone={props.timeZone}
              busy={busy}
              onOpen={() => props.onOpenNote(entry.noteId)}
              onPause={() =>
                run(() => props.reviews.pause(entry.id, entry.revision))
              }
              onResume={() =>
                run(() => props.reviews.resume(entry.id, entry.revision, today))
              }
              onRemove={() =>
                run(() => props.reviews.remove(entry.id, entry.revision))
              }
            />
          ))}
        </ul>
      </section>
      <section
        className="task-card card-glass"
        aria-labelledby="reviews-managed"
      >
        <h2 id="reviews-managed">{t("reviews.managed")}</h2>
        {!props.data.paused.length &&
        !props.data.schedules.some(
          (entry) => entry.availability === "unavailable",
        ) ? (
          <p className="muted">{t("reviews.noManaged")}</p>
        ) : null}
        <ul className="task-list">
          {props.data.schedules
            .filter(
              (entry) =>
                entry.state === "paused" ||
                entry.availability === "unavailable",
            )
            .map((entry) => (
              <ReviewRow
                key={entry.id}
                entry={entry}
                locale={props.locale}
                timeZone={props.timeZone}
                busy={busy}
                onOpen={() => entry.note && props.onOpenNote(entry.noteId)}
                onPause={() =>
                  run(() => props.reviews.pause(entry.id, entry.revision))
                }
                onResume={() =>
                  run(() =>
                    props.reviews.resume(entry.id, entry.revision, today),
                  )
                }
                onRemove={() =>
                  run(() => props.reviews.remove(entry.id, entry.revision))
                }
              />
            ))}
        </ul>
      </section>
      <section
        className="task-card card-glass"
        aria-labelledby="reviews-history"
      >
        <h2 id="reviews-history">{t("reviews.history")}</h2>
        <ReviewHistory
          data={props.data}
          locale={props.locale}
          timeZone={props.timeZone}
        />
      </section>
    </section>
  );
}

function ReviewCard(props: {
  entry: ReviewEntry;
  locale: Locale;
  timeZone: string;
  busy: boolean;
  onOpen: () => void;
  onRate: (rating: ReviewRating) => void;
  onPostpone: () => void;
  onPause: () => void;
  onRemove: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const text = props.entry.note
    ? plainText(props.entry.note.body).slice(0, 900)
    : "";
  return (
    <article aria-labelledby={`review-${props.entry.id}`}>
      <p className="muted">
        {props.entry.queueState === "overdue"
          ? t("reviews.overdue")
          : t("reviews.due")}
      </p>
      <h3 id={`review-${props.entry.id}`}>
        {props.entry.note?.title || t("reviews.noteUnavailable")}
      </h3>
      {text ? (
        <p>
          <bdi>{text}</bdi>
        </p>
      ) : (
        <p className="muted">{t("reviews.emptyNote")}</p>
      )}
      <div className="cluster">
        <button className="btn" type="button" onClick={props.onOpen}>
          {t("reviews.openNote")}
        </button>
        {(["again", "hard", "good", "easy"] as const).map((rating) => (
          <button
            key={rating}
            className={rating === "good" ? "btn primary" : "btn"}
            type="button"
            disabled={props.busy}
            onClick={() => props.onRate(rating)}
          >
            {t(`reviews.rating.${rating}`)}
          </button>
        ))}
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onPostpone}
        >
          {t("reviews.postpone")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onPause}
        >
          {t("reviews.pause")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onRemove}
        >
          {t("reviews.remove")}
        </button>
      </div>
    </article>
  );
}

function ReviewRow(props: {
  entry: ReviewEntry;
  locale: Locale;
  timeZone: string;
  busy: boolean;
  onOpen: () => void;
  onPause: () => void;
  onResume: () => void;
  onRemove: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const unavailable = props.entry.availability === "unavailable";
  return (
    <li>
      <div className="task-progress">
        <span>
          <bdi>{props.entry.note?.title || t("reviews.noteUnavailable")}</bdi>
        </span>
        <small className="muted">
          {unavailable
            ? t("reviews.unavailable")
            : `${t(`reviews.state.${props.entry.queueState}`)} · ${displayDate(props.entry.dueDate, props.locale, props.timeZone)}`}
        </small>
      </div>
      <div className="cluster">
        {props.entry.note ? (
          <button className="btn" type="button" onClick={props.onOpen}>
            {t("reviews.openNote")}
          </button>
        ) : null}
        {props.entry.state === "paused" ? (
          <button
            className="btn"
            type="button"
            disabled={props.busy || unavailable}
            onClick={props.onResume}
          >
            {t("reviews.resume")}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={props.busy || unavailable}
            onClick={props.onPause}
          >
            {t("reviews.pause")}
          </button>
        )}
        <button
          className="btn"
          type="button"
          disabled={props.busy}
          onClick={props.onRemove}
        >
          {t("reviews.remove")}
        </button>
      </div>
    </li>
  );
}

function ReviewHistory(props: {
  data: ReviewsWorkspace;
  locale: Locale;
  timeZone: string;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const rows = props.data.schedules
    .flatMap((schedule) =>
      schedule.history.map((history) => ({ history, schedule })),
    )
    .sort((left, right) =>
      right.history.createdAt.localeCompare(left.history.createdAt),
    )
    .slice(0, 12);
  if (!rows.length) return <p className="muted">{t("reviews.noHistory")}</p>;
  return (
    <ul className="task-list">
      {rows.map(({ history, schedule }) => (
        <li key={history.id}>
          <bdi>{schedule.note?.title || t("reviews.noteUnavailable")}</bdi>
          <small className="muted">
            {history.outcome === "postpone"
              ? t("reviews.postponed")
              : t(`reviews.rating.${history.outcome}`)}{" "}
            · {displayDate(history.reviewedDate, props.locale, props.timeZone)}{" "}
            → {displayDate(history.nextDueDate, props.locale, props.timeZone)}
          </small>
        </li>
      ))}
    </ul>
  );
}
