import { useState } from "react";
import type {
  GoalDetails,
  Goals,
  GoalsWorkspace,
  ReviewDraft,
} from "../application/goals";
import type { GoalProgress } from "../domain/goals";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function GoalsScreen(props: {
  profileId: string;
  data: GoalsWorkspace;
  goals: Goals;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  onOpenTask: (id: string) => void;
  onOpenHabit: (id: string) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [error, setError] = useState("");
  const today = localDate(props.timeZone);
  const create = async (draft: {
    title: string;
    description: string;
    startDate: string;
    targetDate: string | null;
    progress: GoalProgress;
  }) => {
    try {
      await props.goals.createGoal(props.profileId, draft);
      await props.onChanged();
      setError("");
      return true;
    } catch {
      setError(t("goals.saveFailed"));
      return false;
    }
  };
  return (
    <section className="content-card module" aria-labelledby="goals-heading">
      <div className="page-header">
        <div>
          <h1 id="goals-heading">{t("goals.heading")}</h1>
          <p className="muted">{t("goals.intro")}</p>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("goals.offline")}
        </p>
      ) : null}
      <GoalComposer locale={props.locale} initialDate={today} submit={create} />
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!props.data.goals.length ? (
        <p className="muted">{t("goals.empty")}</p>
      ) : null}
      <div className="board-cards">
        {props.data.goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            data={props.data}
            goals={props.goals}
            locale={props.locale}
            today={today}
            onChanged={props.onChanged}
            onOpenTask={props.onOpenTask}
            onOpenHabit={props.onOpenHabit}
          />
        ))}
      </div>
    </section>
  );
}

function GoalComposer(props: {
  locale: Locale;
  initialDate: string;
  submit: (draft: {
    title: string;
    description: string;
    startDate: string;
    targetDate: string | null;
    progress: GoalProgress;
  }) => Promise<boolean>;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(props.initialDate);
  const [targetDate, setTargetDate] = useState("");
  const [mode, setMode] = useState<GoalProgress["mode"]>("manual");
  const [target, setTarget] = useState("1");
  const [current, setCurrent] = useState("0");
  const [periodStart, setPeriodStart] = useState(props.initialDate);
  const [periodEnd, setPeriodEnd] = useState(props.initialDate);
  const [saving, setSaving] = useState(false);
  const progress = (): GoalProgress => {
    if (mode === "linkedTasks") return { mode };
    if (mode === "habitCheckIns")
      return {
        mode,
        target: Number(target),
        periodStart,
        periodEnd,
      };
    return { mode, target: Number(target), current: Number(current) };
  };
  return (
    <form
      className="task-card card-glass"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void props
          .submit({
            title,
            description,
            startDate,
            targetDate: targetDate || null,
            progress: progress(),
          })
          .then((saved) => {
            if (!saved) return;
            setTitle("");
            setDescription("");
            setTarget("1");
            setCurrent("0");
          })
          .finally(() => setSaving(false));
      }}
    >
      <h2>{t("goals.create")}</h2>
      <div className="cluster">
        <label>
          {t("goals.title")}
          <input
            className="field"
            aria-label={t("goals.title")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t("goals.startDate")}
          <input
            className="field"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label>
          {t("goals.targetDate")}
          <input
            className="field"
            type="date"
            value={targetDate}
            min={startDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </label>
      </div>
      <label>
        {t("goals.description")}
        <textarea
          className="field"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label>
        {t("goals.progressMode")}
        <select
          className="select"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as GoalProgress["mode"])
          }
        >
          <option value="manual">{t("goals.modeManual")}</option>
          <option value="linkedTasks">{t("goals.modeTasks")}</option>
          <option value="habitCheckIns">{t("goals.modeHabits")}</option>
        </select>
      </label>
      {mode !== "linkedTasks" ? (
        <div className="cluster">
          <label>
            {t("goals.target")}
            <input
              className="field"
              type="number"
              min="1"
              step="1"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          {mode === "manual" ? (
            <label>
              {t("goals.current")}
              <input
                className="field"
                type="number"
                min="0"
                step="1"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                {t("goals.periodStart")}
                <input
                  className="field"
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label>
                {t("goals.periodEnd")}
                <input
                  className="field"
                  type="date"
                  min={periodStart}
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </>
          )}
        </div>
      ) : null}
      <button className="btn primary" disabled={!title.trim() || saving}>
        {t("goals.create")}
      </button>
    </form>
  );
}

function GoalCard(props: {
  goal: GoalDetails;
  data: GoalsWorkspace;
  goals: Goals;
  locale: Locale;
  today: string;
  onChanged: () => Promise<void>;
  onOpenTask: (id: string) => void;
  onOpenHabit: (id: string) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDate, setMilestoneDate] = useState("");
  const [review, setReview] = useState<ReviewDraft>({
    periodStart: props.today,
    periodEnd: props.today,
    accomplishments: "",
    blockers: "",
    notes: "",
    nextActions: "",
  });
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const linked = new Set(
    props.goal.relations.map(
      (relation) => `${relation.targetKind}:${relation.targetId}`,
    ),
  );
  const update = async (work: () => Promise<unknown>) => {
    try {
      await work();
      await props.onChanged();
      setError("");
    } catch {
      setError(t("goals.saveFailed"));
    }
  };
  const progress = props.goal.progressSummary;
  return (
    <article
      className="task-card card-glass"
      aria-labelledby={`goal-${props.goal.id}`}
    >
      <div className="page-header">
        <div>
          <h2 id={`goal-${props.goal.id}`}>{props.goal.title}</h2>
          <p className="muted">
            {props.goal.description || t("goals.noDescription")}
          </p>
        </div>
        <span className="muted">{t(`goals.status.${props.goal.status}`)}</span>
      </div>
      <div className="task-progress-block">
        <div className="task-progress">
          <span>
            {t("goals.progress")}: {progress.current}
            {progress.target === null ? "" : ` / ${progress.target}`}
          </span>
          <strong>{progress.percent}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
          aria-label={t("goals.progress")}
        >
          <span style={{ width: `${progress.percent}%` }} />
        </div>
        {progress.remaining !== null ? (
          <small className="muted">
            {t("goals.remaining")}: {progress.remaining}
          </small>
        ) : null}
        {progress.unavailable ? (
          <small className="muted">
            {t("goals.unavailable")}: {progress.unavailable}
          </small>
        ) : null}
      </div>
      <p className="muted">
        {t("goals.timeframe")}: {props.goal.startDate} –{" "}
        {props.goal.targetDate ?? t("goals.noTargetDate")}
      </p>
      {props.goal.nextMilestone ? (
        <p className="muted">
          {t("goals.nextMilestone")}: {props.goal.nextMilestone.title}
          {props.goal.nextMilestone.targetDate
            ? ` · ${props.goal.nextMilestone.targetDate}`
            : ""}
        </p>
      ) : null}
      {editing ? (
        <GoalEditor
          goal={props.goal}
          locale={props.locale}
          onSave={(patch) =>
            update(() =>
              props.goals.updateGoal(props.goal.id, props.goal.revision, patch),
            ).then(() => setEditing(false))
          }
          onCancel={() => setEditing(false)}
        />
      ) : null}
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => setEditing((value) => !value)}
        >
          {t("goals.edit")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            void update(() =>
              props.goals.archiveGoal(
                props.goal.id,
                props.goal.revision,
                props.goal.status !== "archived",
              ),
            )
          }
        >
          {props.goal.status === "archived"
            ? t("goals.restore")
            : t("goals.archive")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            if (confirm(t("goals.confirmDelete")))
              void update(() =>
                props.goals.deleteGoal(props.goal.id, props.goal.revision),
              );
          }}
        >
          {t("goals.delete")}
        </button>
      </div>
      <section aria-labelledby={`milestones-${props.goal.id}`}>
        <h3 id={`milestones-${props.goal.id}`}>{t("goals.milestones")}</h3>
        <form
          className="cluster"
          onSubmit={(event) => {
            event.preventDefault();
            void update(() =>
              props.goals.createMilestone(props.goal.id, props.goal.revision, {
                title: milestoneTitle,
                targetDate: milestoneDate || null,
              }),
            ).then(() => {
              setMilestoneTitle("");
              setMilestoneDate("");
            });
          }}
        >
          <input
            className="field"
            aria-label={t("goals.milestoneTitle")}
            value={milestoneTitle}
            onChange={(event) => setMilestoneTitle(event.target.value)}
          />
          <input
            className="field"
            type="date"
            aria-label={t("goals.targetDate")}
            value={milestoneDate}
            onChange={(event) => setMilestoneDate(event.target.value)}
          />
          <button className="btn" disabled={!milestoneTitle.trim()}>
            {t("goals.addMilestone")}
          </button>
        </form>
        {!props.goal.milestones.length ? (
          <p className="muted">{t("goals.noMilestones")}</p>
        ) : null}
        <ul className="task-list">
          {props.goal.milestones.map((milestone, index) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              index={index}
              total={props.goal.milestones.length}
              locale={props.locale}
              onUpdate={(patch) =>
                update(() =>
                  props.goals.updateMilestone(
                    milestone.id,
                    milestone.revision,
                    patch,
                  ),
                )
              }
              onMove={(direction) => {
                const rows = [...props.goal.milestones];
                const other = rows[index + direction];
                if (!other) return;
                rows[index] = other;
                rows[index + direction] = milestone;
                void update(() =>
                  props.goals.reorderMilestones(props.goal.id, rows),
                );
              }}
              onDelete={() =>
                update(() =>
                  props.goals.deleteMilestone(milestone.id, milestone.revision),
                )
              }
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby={`links-${props.goal.id}`}>
        <h3 id={`links-${props.goal.id}`}>{t("goals.links")}</h3>
        <ul className="task-list">
          {props.goal.relations.map((relation) => (
            <li key={relation.id} className="task-row">
              {relation.available ? (
                <button
                  className="task-title-link"
                  type="button"
                  onClick={() =>
                    relation.targetKind === "task"
                      ? props.onOpenTask(relation.targetId)
                      : props.onOpenHabit(relation.targetId)
                  }
                >
                  {relation.title}
                </button>
              ) : (
                <span className="muted">{t("goals.linkUnavailable")}</span>
              )}
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void update(() =>
                    props.goals.unlinkRecord(relation.id, relation.revision),
                  )
                }
              >
                {t("goals.unlink")}
              </button>
            </li>
          ))}
        </ul>
        <div className="cluster">
          {props.data.tasks
            .filter((task) => !linked.has(`task:${task.id}`))
            .map((task) => (
              <button
                key={task.id}
                className="btn"
                type="button"
                onClick={() =>
                  void update(() =>
                    props.goals.linkRecord(
                      props.goal.id,
                      props.goal.revision,
                      "task",
                      task.id,
                    ),
                  )
                }
              >
                {t("goals.linkTask")}: {task.title}
              </button>
            ))}
          {props.data.habits
            .filter((habit) => !linked.has(`habit:${habit.id}`))
            .map((habit) => (
              <button
                key={habit.id}
                className="btn"
                type="button"
                onClick={() =>
                  void update(() =>
                    props.goals.linkRecord(
                      props.goal.id,
                      props.goal.revision,
                      "habit",
                      habit.id,
                    ),
                  )
                }
              >
                {t("goals.linkHabit")}: {habit.title}
              </button>
            ))}
        </div>
      </section>
      <section aria-labelledby={`review-${props.goal.id}`}>
        <h3 id={`review-${props.goal.id}`}>{t("goals.weeklyReview")}</h3>
        <ReviewEditor
          locale={props.locale}
          review={review}
          onChange={setReview}
          onSave={() =>
            update(async () => {
              if (editingReview) {
                const current = props.goal.reviews.find(
                  (item) => item.id === editingReview,
                );
                if (!current) throw new Error("review unavailable");
                await props.goals.updateWeeklyReview(
                  current.id,
                  current.revision,
                  review,
                );
              } else {
                await props.goals.createWeeklyReview(
                  props.goal.id,
                  props.goal.revision,
                  review,
                );
              }
              setEditingReview(null);
            })
          }
        />
        <ul className="task-list">
          {props.goal.reviews.map((item) => (
            <li key={item.id} className="task-row">
              <span>
                {item.periodStart} – {item.periodEnd} · {item.progressSummary}%
              </span>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setEditingReview(item.id);
                  setReview({
                    periodStart: item.periodStart,
                    periodEnd: item.periodEnd,
                    accomplishments: item.accomplishments,
                    blockers: item.blockers,
                    notes: item.notes,
                    nextActions: item.nextActions,
                  });
                }}
              >
                {t("goals.edit")}
              </button>
            </li>
          ))}
        </ul>
      </section>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function GoalEditor(props: {
  goal: GoalDetails;
  locale: Locale;
  onSave: (patch: Parameters<Goals["updateGoal"]>[2]) => void;
  onCancel: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.goal.title);
  const [description, setDescription] = useState(props.goal.description);
  const [status, setStatus] = useState(props.goal.status);
  const [startDate, setStartDate] = useState(props.goal.startDate);
  const [targetDate, setTargetDate] = useState(props.goal.targetDate ?? "");
  const [mode, setMode] = useState<GoalProgress["mode"]>(
    props.goal.progress.mode,
  );
  const [target, setTarget] = useState(
    props.goal.progress.mode === "linkedTasks"
      ? "1"
      : String(props.goal.progress.target),
  );
  const [current, setCurrent] = useState(
    props.goal.progress.mode === "manual"
      ? String(props.goal.progress.current)
      : "0",
  );
  const [periodStart, setPeriodStart] = useState(
    props.goal.progress.mode === "habitCheckIns"
      ? props.goal.progress.periodStart
      : props.goal.startDate,
  );
  const [periodEnd, setPeriodEnd] = useState(
    props.goal.progress.mode === "habitCheckIns"
      ? props.goal.progress.periodEnd
      : (props.goal.targetDate ?? props.goal.startDate),
  );
  const progress = (): GoalProgress => {
    if (mode === "linkedTasks") return { mode };
    if (mode === "habitCheckIns")
      return { mode, target: Number(target), periodStart, periodEnd };
    return { mode, target: Number(target), current: Number(current) };
  };
  return (
    <div className="cluster">
      <input
        className="field"
        aria-label={t("goals.title")}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className="field"
        aria-label={t("goals.description")}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <label>
        {t("goals.startDate")}
        <input
          className="field"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
      </label>
      <label>
        {t("goals.targetDate")}
        <input
          className="field"
          type="date"
          min={startDate}
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
        />
      </label>
      <label>
        {t("goals.progressMode")}
        <select
          className="select"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as GoalProgress["mode"])
          }
        >
          <option value="manual">{t("goals.modeManual")}</option>
          <option value="linkedTasks">{t("goals.modeTasks")}</option>
          <option value="habitCheckIns">{t("goals.modeHabits")}</option>
        </select>
      </label>
      {mode !== "linkedTasks" ? (
        <>
          <label>
            {t("goals.target")}
            <input
              className="field"
              type="number"
              min="1"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
          {mode === "manual" ? (
            <label>
              {t("goals.current")}
              <input
                className="field"
                type="number"
                min="0"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                {t("goals.periodStart")}
                <input
                  className="field"
                  type="date"
                  value={periodStart}
                  onChange={(event) => setPeriodStart(event.target.value)}
                />
              </label>
              <label>
                {t("goals.periodEnd")}
                <input
                  className="field"
                  type="date"
                  min={periodStart}
                  value={periodEnd}
                  onChange={(event) => setPeriodEnd(event.target.value)}
                />
              </label>
            </>
          )}
        </>
      ) : null}
      <select
        className="select"
        aria-label={t("goals.status")}
        value={status}
        onChange={(event) =>
          setStatus(event.target.value as GoalDetails["status"])
        }
      >
        <option value="active">{t("goals.status.active")}</option>
        <option value="completed">{t("goals.status.completed")}</option>
        <option value="archived">{t("goals.status.archived")}</option>
      </select>
      <button
        className="btn"
        type="button"
        onClick={() =>
          props.onSave({
            title,
            description,
            status,
            startDate,
            targetDate: targetDate || null,
            progress: progress(),
          })
        }
      >
        {t("goals.save")}
      </button>
      <button className="btn" type="button" onClick={props.onCancel}>
        {t("goals.cancel")}
      </button>
    </div>
  );
}

function MilestoneRow(props: {
  milestone: GoalDetails["milestones"][number];
  index: number;
  total: number;
  locale: Locale;
  onUpdate: (patch: {
    title?: string;
    targetDate?: string | null;
    completed?: boolean;
  }) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(props.milestone.title);
  const [targetDate, setTargetDate] = useState(
    props.milestone.targetDate ?? "",
  );
  return (
    <li className="task-row">
      <input
        type="checkbox"
        aria-label={props.milestone.title}
        checked={props.milestone.completed}
        onChange={(event) =>
          props.onUpdate({ completed: event.target.checked })
        }
      />
      {editing ? (
        <>
          <input
            className="field"
            aria-label={t("goals.milestoneTitle")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            className="field"
            type="date"
            aria-label={t("goals.targetDate")}
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
          <button
            className="btn"
            type="button"
            disabled={!title.trim()}
            onClick={() => {
              props.onUpdate({ title, targetDate: targetDate || null });
              setEditing(false);
            }}
          >
            {t("goals.save")}
          </button>
        </>
      ) : (
        <>
          <span>{props.milestone.title}</span>
          <small className="muted">{props.milestone.targetDate ?? ""}</small>
        </>
      )}
      <button
        className="btn"
        type="button"
        onClick={() => setEditing((value) => !value)}
      >
        {t("goals.edit")}
      </button>
      <button
        className="btn"
        type="button"
        disabled={props.index === 0}
        aria-label={t("goals.moveUp")}
        onClick={() => props.onMove(-1)}
      >
        ↑
      </button>
      <button
        className="btn"
        type="button"
        disabled={props.index === props.total - 1}
        aria-label={t("goals.moveDown")}
        onClick={() => props.onMove(1)}
      >
        ↓
      </button>
      <button className="btn" type="button" onClick={props.onDelete}>
        {t("goals.delete")}
      </button>
    </li>
  );
}

function ReviewEditor(props: {
  locale: Locale;
  review: ReviewDraft;
  onChange: (review: ReviewDraft) => void;
  onSave: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const change = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) =>
    props.onChange({ ...props.review, [key]: value });
  return (
    <div className="cluster">
      <label>
        {t("goals.periodStart")}
        <input
          className="field"
          type="date"
          value={props.review.periodStart}
          onChange={(event) => change("periodStart", event.target.value)}
        />
      </label>
      <label>
        {t("goals.periodEnd")}
        <input
          className="field"
          type="date"
          min={props.review.periodStart}
          value={props.review.periodEnd}
          onChange={(event) => change("periodEnd", event.target.value)}
        />
      </label>
      <label>
        {t("goals.accomplishments")}
        <textarea
          className="field"
          value={props.review.accomplishments}
          onChange={(event) => change("accomplishments", event.target.value)}
        />
      </label>
      <label>
        {t("goals.blockers")}
        <textarea
          className="field"
          value={props.review.blockers}
          onChange={(event) => change("blockers", event.target.value)}
        />
      </label>
      <label>
        {t("goals.reviewNotes")}
        <textarea
          className="field"
          value={props.review.notes}
          onChange={(event) => change("notes", event.target.value)}
        />
      </label>
      <label>
        {t("goals.nextActions")}
        <textarea
          className="field"
          value={props.review.nextActions}
          onChange={(event) => change("nextActions", event.target.value)}
        />
      </label>
      <button className="btn" type="button" onClick={props.onSave}>
        {t("goals.saveReview")}
      </button>
    </div>
  );
}
