import { useEffect, useState } from "react";
import type { Library, Productivity } from "../application/productivity";
import { WorkspaceError } from "../domain/dashboard";
import {
  searchFold,
  sortedTasks,
  taskColumn,
  type TaskColumn,
  type TaskRecord,
} from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";
import { Modal } from "./modal";

const columns: TaskColumn[] = ["todo", "doing", "done"];

export function TasksScreen(props: {
  library: Library;
  productivity: Productivity;
  locale: "en" | "fa";
  selectedId?: string | null;
  onSelected?: ((id: string | null) => void) | undefined;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [selected, setSelected] = useState<string | null>(
    props.selectedId ?? null,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (props.selectedId) setSelected(props.selectedId);
  }, [props.selectedId]);
  const tasks = sortedTasks(props.library.tasks).filter(
    (task) =>
      searchFold(
        `${task.title} ${task.details} ${(task.labels ?? []).join(" ")}`,
      ).includes(searchFold(query)) &&
      (!priority || task.priority === Number(priority)),
  );
  const current = props.library.tasks.find((task) => task.id === selected);
  async function move(task: TaskRecord, column: TaskColumn, index: number) {
    if (pending) return;
    setPending(true);
    try {
      await props.productivity.moveTask(task.id, task.revision, column, index);
      setError("");
    } catch {
      setError(t("tasks.invalid"));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="content-card module" aria-label={t("nav.tasks")}>
      <div className="page-header">
        <div>
          <span className="section-kicker">ORGANIZE / 02</span>
          <h1>
            {t("nav.tasks")} <span className="heading-star">✳</span>
          </h1>
        </div>
      </div>
      <form
        className="cluster"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || pending) return;
          setPending(true);
          void props.productivity
            .createTask(title)
            .then(() => {
              setTitle("");
              setError("");
            })
            .catch(() => setError(t("tasks.invalid")))
            .finally(() => setPending(false));
        }}
      >
        <label>
          {t("capture.title")}
          <input
            className="field"
            value={title}
            maxLength={300}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button
          className="btn primary"
          disabled={pending || !title.trim()}
          type="submit"
        >
          {t("command.task")}
        </button>
      </form>
      <div className="cluster task-filters">
        <label>
          {t("notes.search")}
          <input
            className="field"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          {t("tasks.priority")}
          <select
            className="select"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">{t("tasks.all")}</option>
            {[1, 2, 3].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <div className="task-board" aria-label={t("tasks.board")}>
        {columns.map((column) => {
          const rows = tasks.filter((task) => taskColumn(task) === column);
          return (
            <section
              className={`board-column column-${column}`}
              key={column}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const task = props.library.tasks.find(
                  (row) =>
                    row.id === event.dataTransfer.getData("text/venus-task"),
                );
                if (task)
                  void move(
                    task,
                    column,
                    props.library.tasks.filter(
                      (row) => taskColumn(row) === column,
                    ).length,
                  );
              }}
            >
              <h2>
                {t(`tasks.${column}`)}{" "}
                <span className="muted">{rows.length}</span>
              </h2>
              <ul className="board-cards">
                {rows.map((task) => {
                  const all = sortedTasks(
                    props.library.tasks.filter(
                      (row) => taskColumn(row) === column,
                    ),
                  );
                  const index = all.findIndex((row) => row.id === task.id);
                  return (
                    <li
                      className="task-card card-glass"
                      key={task.id}
                      draggable={!pending}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/venus-task", task.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const dragged = props.library.tasks.find(
                          (row) =>
                            row.id ===
                            event.dataTransfer.getData("text/venus-task"),
                        );
                        if (dragged) void move(dragged, column, index);
                      }}
                    >
                      <button
                        className="task-card-title"
                        type="button"
                        onClick={() => {
                          setSelected(task.id);
                          props.onSelected?.(task.id);
                        }}
                      >
                        <bdi>{task.title}</bdi>
                      </button>
                      {task.details ? (
                        <p className="muted task-excerpt">
                          <bdi>{task.details}</bdi>
                        </p>
                      ) : null}
                      <div className="cluster">
                        <span className="task-badge">
                          {t("tasks.priority")} {task.priority}
                        </span>
                        {task.dueDate ? (
                          <time dateTime={task.dueDate}>{task.dueDate}</time>
                        ) : null}
                        {task.today ? (
                          <span className="task-badge">{t("tasks.today")}</span>
                        ) : null}
                      </div>
                      <div className="cluster">
                        {(task.labels ?? []).map((label) => (
                          <span className="task-badge" key={label}>
                            <bdi>{label}</bdi>
                          </span>
                        ))}
                      </div>
                      {task.checklist?.length ? (
                        <p className="muted">
                          {t("tasks.checklist")}{" "}
                          {task.checklist.filter((item) => item.done).length}/
                          {task.checklist.length}
                        </p>
                      ) : null}
                      <div className="cluster">
                        <label
                          className="sr-only"
                          htmlFor={`column-${task.id}`}
                        >
                          {t("tasks.column")}
                        </label>
                        <select
                          className="select"
                          id={`column-${task.id}`}
                          value={column}
                          disabled={pending}
                          onChange={(event) =>
                            void move(
                              task,
                              event.target.value as TaskColumn,
                              props.library.tasks.filter(
                                (row) => taskColumn(row) === event.target.value,
                              ).length,
                            )
                          }
                        >
                          {columns.map((value) => (
                            <option value={value} key={value}>
                              {t(`tasks.${value}`)}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn"
                          type="button"
                          aria-label={t("repair.up")}
                          disabled={pending || index === 0}
                          onClick={() => void move(task, column, index - 1)}
                        >
                          ↑
                        </button>
                        <button
                          className="btn"
                          type="button"
                          aria-label={t("repair.down")}
                          disabled={pending || index === all.length - 1}
                          onClick={() => void move(task, column, index + 1)}
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {!rows.length ? (
                <p className="muted">{t("widget.none")}</p>
              ) : null}
            </section>
          );
        })}
      </div>
      {current ? (
        <TaskDialog
          task={current}
          productivity={props.productivity}
          locale={props.locale}
          onClose={() => {
            setSelected(null);
            props.onSelected?.(null);
          }}
        />
      ) : null}
    </section>
  );
}

export function TaskDialog(props: {
  task: TaskRecord;
  productivity: Productivity;
  locale: "en" | "fa";
  onClose: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [draft, setDraft] = useState(props.task);
  const [labels, setLabels] = useState((props.task.labels ?? []).join(", "));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemText, setItemText] = useState("");
  useEffect(() => {
    if (!dirty) {
      setDraft(props.task);
      setLabels((props.task.labels ?? []).join(", "));
    }
  }, [props.task, dirty]);
  function patch(patch: Partial<TaskRecord>) {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  }
  async function save() {
    if (pending) return;
    setPending(true);
    try {
      await props.productivity.saveTask(draft.id, draft.revision, {
        title: draft.title,
        details: draft.details,
        column: taskColumn(draft),
        priority: draft.priority,
        dueDate: draft.dueDate,
        eventId: draft.eventId,
        focusRank: draft.focusRank,
        today: draft.today ?? false,
        labels: labels
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        checklist: draft.checklist ?? [],
      });
      props.onClose();
    } catch (error) {
      setError(
        t(
          error instanceof WorkspaceError && error.code === "conflict"
            ? "notes.conflict"
            : "tasks.invalid",
        ),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal label={t("tasks.edit")} onClose={props.onClose}>
      <form
        className="task-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <h2>{t("tasks.edit")}</h2>
        <label>
          {t("capture.title")}
          <input
            className="field"
            required
            maxLength={300}
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </label>
        <label>
          {t("tasks.details")}
          <textarea
            className="field"
            value={draft.details}
            onChange={(event) => patch({ details: event.target.value })}
          />
        </label>
        <div className="cluster">
          <label>
            {t("tasks.column")}
            <select
              className="select"
              value={taskColumn(draft)}
              onChange={(event) =>
                patch({
                  column: event.target.value as TaskColumn,
                  status: event.target.value === "done" ? "done" : "open",
                })
              }
            >
              {columns.map((value) => (
                <option key={value} value={value}>
                  {t(`tasks.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("tasks.priority")}
            <select
              className="select"
              value={draft.priority}
              onChange={(event) =>
                patch({ priority: Number(event.target.value) as 1 | 2 | 3 })
              }
            >
              {[1, 2, 3].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {t("tasks.due")}
            <input
              className="field"
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(event) =>
                patch({ dueDate: event.target.value || null })
              }
            />
          </label>
        </div>
        <label>
          {t("tasks.labels")}
          <input
            className="field"
            value={labels}
            onChange={(event) => {
              setLabels(event.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label className="cluster">
          <input
            type="checkbox"
            checked={draft.today ?? false}
            onChange={(event) => patch({ today: event.target.checked })}
          />
          {t("tasks.today")}
        </label>
        <label>
          {t("tasks.focus")}
          <select
            className="select"
            value={draft.focusRank ?? ""}
            onChange={(event) =>
              patch({
                focusRank: event.target.value
                  ? (Number(event.target.value) as 1 | 2 | 3)
                  : null,
              })
            }
          >
            <option value="">{t("tasks.none")}</option>
            {[1, 2, 3].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          {t("tasks.event")}
          <input
            className="field"
            value={draft.eventId ?? ""}
            onChange={(event) => patch({ eventId: event.target.value || null })}
          />
        </label>
        <fieldset>
          <legend>{t("tasks.checklist")}</legend>
          <ul className="checklist">
            {(draft.checklist ?? []).map((item) => (
              <li key={item.id} className="cluster">
                <input
                  type="checkbox"
                  aria-label={item.text}
                  checked={item.done}
                  onChange={(event) =>
                    patch({
                      checklist: (draft.checklist ?? []).map((row) =>
                        row.id === item.id
                          ? { ...row, done: event.target.checked }
                          : row,
                      ),
                    })
                  }
                />
                <input
                  className="field"
                  aria-label={t("tasks.checklistItem")}
                  value={item.text}
                  onChange={(event) =>
                    patch({
                      checklist: (draft.checklist ?? []).map((row) =>
                        row.id === item.id
                          ? { ...row, text: event.target.value }
                          : row,
                      ),
                    })
                  }
                />
                <button
                  className="btn"
                  type="button"
                  aria-label={t("repair.delete")}
                  onClick={() =>
                    patch({
                      checklist: draft.checklist?.filter(
                        (row) => row.id !== item.id,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="cluster">
            <input
              className="field"
              aria-label={t("tasks.checklistItem")}
              maxLength={500}
              value={itemText}
              onChange={(event) => setItemText(event.target.value)}
            />
            <button
              className="btn"
              type="button"
              disabled={
                !itemText.trim() || (draft.checklist?.length ?? 0) >= 100
              }
              onClick={() => {
                patch({
                  checklist: [
                    ...(draft.checklist ?? []),
                    {
                      id: crypto.randomUUID(),
                      text: itemText.trim(),
                      done: false,
                    },
                  ],
                });
                setItemText("");
              }}
            >
              {t("tasks.addItem")}
            </button>
          </div>
        </fieldset>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {error === t("notes.conflict") ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setDraft(props.task);
              setLabels((props.task.labels ?? []).join(", "));
              setDirty(false);
              setError("");
            }}
          >
            {t("repair.reload")}
          </button>
        ) : null}
        <div className="dialog-actions">
          <button className="btn primary" disabled={pending} type="submit">
            {t("tasks.save")}
          </button>
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            {t("repair.delete")}
          </button>
          <button className="btn" type="button" onClick={props.onClose}>
            {t("dialog.close")}
          </button>
        </div>
        {confirmDelete ? (
          <div role="alert">
            <p>{t("repair.confirmDelete")}</p>
            <button
              className="btn"
              disabled={pending}
              type="button"
              onClick={() => {
                setPending(true);
                void props.productivity
                  .deleteTask(draft.id, draft.revision)
                  .then(props.onClose)
                  .catch(() => setError(t("notes.conflict")))
                  .finally(() => setPending(false));
              }}
            >
              {t("settings.confirm")}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              {t("settings.cancel")}
            </button>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
