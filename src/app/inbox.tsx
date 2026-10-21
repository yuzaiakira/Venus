import { useEffect, useMemo, useRef, useState } from "react";
import type { Inbox } from "../application/inbox";
import type { InboxWorkspace } from "../application/inbox";
import type {
  InboxDraft,
  InboxItemRecord,
  InboxKind,
  InboxStatus,
} from "../domain/inbox";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";

function formatWhen(value: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function InboxScreen(props: {
  profileId: string;
  data: InboxWorkspace;
  inbox: Inbox;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  onOpenTask: (id: string) => void;
  onOpenNote: (id: string) => void;
  onOpenEvent: () => void;
  focusCapture?: number;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const input = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<InboxStatus>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (props.focusCapture) input.current?.focus();
  }, [props.focusCapture]);
  const items = useMemo(
    () => props.data.items.filter((item) => item.status === filter),
    [props.data.items, filter],
  );
  const selected =
    props.data.items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  async function run(work: () => Promise<unknown>, success = "inbox.saved") {
    setBusy(true);
    setError("");
    try {
      await work();
      await props.onChanged();
      setNotice(t(success as MessageKey));
    } catch {
      setError(t("inbox.failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card module" aria-labelledby="inbox-heading">
      <div className="page-header">
        <div>
          <h1 id="inbox-heading">{t("inbox.heading")}</h1>
          <p className="muted">{t("inbox.intro")}</p>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("inbox.offline")}
        </p>
      ) : null}
      <p className="muted tiny-label">{t("inbox.localOnly")}</p>
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
      <section className="task-card card-glass" aria-labelledby="inbox-capture">
        <h2 id="inbox-capture">{t("inbox.capture")}</h2>
        <p className="muted">{t("inbox.captureHint")}</p>
        <label>
          {t("inbox.content")}
          <textarea
            ref={input}
            className="field"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </label>
        <button
          className="btn primary"
          type="button"
          disabled={busy || !content.trim()}
          onClick={() =>
            void run(async () => {
              const row = await props.inbox.create(
                props.profileId,
                content,
                props.timeZone,
              );
              setContent("");
              setSelectedId(row.id);
              setFilter("pending");
            })
          }
        >
          {t("inbox.submit")}
        </button>
      </section>
      <section className="task-card card-glass" aria-label={t("inbox.heading")}>
        <div className="cluster" role="tablist" aria-label={t("inbox.heading")}>
          {(["pending", "accepted", "rejected", "undone"] as const).map(
            (status) => (
              <button
                key={status}
                className={`btn${filter === status ? " primary" : ""}`}
                type="button"
                role="tab"
                aria-selected={filter === status}
                onClick={() => setFilter(status)}
              >
                {t(`inbox.${status}` as MessageKey)} (
                {props.data[status].length})
              </button>
            ),
          )}
        </div>
        {!items.length ? <p className="muted">{t("inbox.empty")}</p> : null}
        <div className="board-cards" aria-live="polite">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`task-card card-glass${selected?.id === item.id ? " selected" : ""}`}
              onClick={() => setSelectedId(item.id)}
            >
              <strong>
                <bdi>{item.draft.title}</bdi>
              </strong>
              <small className="muted">
                {t(`inbox.kind.${item.selectedKind}` as MessageKey)} ·{" "}
                {formatWhen(item.updatedAt, props.locale, props.timeZone)}
              </small>
            </button>
          ))}
        </div>
      </section>
      {selected ? (
        <InboxEditor
          item={selected}
          t={t}
          busy={busy}
          timeZone={props.timeZone}
          onRun={run}
          onSave={(draft) =>
            props.inbox.updateDraft(
              props.profileId,
              selected.id,
              selected.revision,
              draft,
            )
          }
          onKind={(kind) =>
            props.inbox.reclassify(
              props.profileId,
              selected.id,
              selected.revision,
              kind,
              props.timeZone,
            )
          }
          onAccept={() =>
            props.inbox.accept(props.profileId, selected.id, selected.revision)
          }
          onReject={() =>
            props.inbox.reject(props.profileId, selected.id, selected.revision)
          }
          onRestore={() =>
            props.inbox.restore(props.profileId, selected.id, selected.revision)
          }
          onUndo={() =>
            props.inbox.undo(props.profileId, selected.id, selected.revision)
          }
          onRemove={() =>
            props.inbox.remove(
              props.profileId,
              selected.id,
              selected.revision,
              window.confirm(t("inbox.confirmRemove")),
            )
          }
          onOpen={() => {
            if (!selected.destination) return;
            if (selected.destination.kind === "task")
              props.onOpenTask(selected.destination.id);
            else if (selected.destination.kind === "note")
              props.onOpenNote(selected.destination.id);
            else props.onOpenEvent();
          }}
        />
      ) : null}
    </section>
  );
}

function InboxEditor(props: {
  item: InboxItemRecord;
  t: (key: MessageKey) => string;
  busy: boolean;
  timeZone: string;
  onRun: (work: () => Promise<unknown>, success?: string) => Promise<void>;
  onSave: (draft: InboxDraft) => Promise<unknown>;
  onKind: (kind: InboxKind) => Promise<unknown>;
  onAccept: () => Promise<unknown>;
  onReject: () => Promise<unknown>;
  onRestore: () => Promise<unknown>;
  onUndo: () => Promise<unknown>;
  onRemove: () => Promise<unknown>;
  onOpen: () => void;
}) {
  const { item, t } = props;
  const [draft, setDraft] = useState<InboxDraft>(item.draft);
  useEffect(() => setDraft(item.draft), [item]);
  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }) as InboxDraft);
  return (
    <section className="task-card card-glass" aria-labelledby="inbox-editor">
      <div className="page-header">
        <div>
          <h2 id="inbox-editor">{t("inbox.edit")}</h2>
          <p className="muted">
            {t("inbox.confidence")}: {item.suggestion.confidence} ·{" "}
            {t(`inbox.reason.${item.suggestion.reason}` as MessageKey)}
          </p>
        </div>
      </div>
      {item.status === "pending" ? (
        <>
          <label>
            {t("inbox.kind")}
            <select
              className="select"
              value={draft.kind}
              onChange={(event) => {
                const kind = (event.currentTarget as HTMLSelectElement)
                  .value as InboxKind;
                void props.onRun(() => props.onKind(kind));
              }}
            >
              {(["task", "note", "event"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(`inbox.kind.${kind}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <DraftFields draft={draft} t={t} set={set} />
          <div className="cluster">
            <button
              className="btn"
              type="button"
              disabled={props.busy}
              onClick={() => void props.onRun(() => props.onSave(draft))}
            >
              {t("inbox.save")}
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={props.busy}
              onClick={() => void props.onRun(props.onAccept, "inbox.created")}
            >
              {t("inbox.accept")}
            </button>
            <button
              className="btn"
              type="button"
              disabled={props.busy}
              onClick={() => void props.onRun(props.onReject)}
            >
              {t("inbox.reject")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            <bdi>{item.content}</bdi>
          </p>
          <div className="cluster">
            {item.status === "accepted" ? (
              <>
                <button
                  className="btn primary"
                  type="button"
                  onClick={props.onOpen}
                >
                  {t("inbox.open")}
                </button>
                <button
                  className="btn"
                  type="button"
                  disabled={props.busy}
                  onClick={() => void props.onRun(props.onUndo)}
                >
                  {t("inbox.undo")}
                </button>
              </>
            ) : (
              <button
                className="btn primary"
                type="button"
                disabled={props.busy}
                onClick={() => void props.onRun(props.onRestore)}
              >
                {t("inbox.restore")}
              </button>
            )}
            <button
              className="btn"
              type="button"
              disabled={props.busy}
              onClick={() => void props.onRun(props.onRemove)}
            >
              {t("inbox.remove")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function DraftFields(props: {
  draft: InboxDraft;
  t: (key: MessageKey) => string;
  set: (key: string, value: unknown) => void;
}) {
  const { draft, t, set } = props;
  return (
    <div className="form-grid">
      <label>
        {t("inbox.title")}
        <input
          className="field"
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </label>
      {draft.kind === "task" ? (
        <>
          <label>
            {t("inbox.details")}
            <textarea
              className="field"
              value={draft.details}
              onChange={(e) => set("details", e.target.value)}
            />
          </label>
          <label>
            {t("inbox.priority")}
            <select
              className="select"
              value={draft.priority}
              onChange={(e) =>
                set("priority", Number(e.target.value) as 1 | 2 | 3)
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.today}
              onChange={(e) => set("today", e.target.checked)}
            />{" "}
            {t("inbox.today")}
          </label>
          <label>
            {t("inbox.dueDate")}
            <input
              className="field"
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(e) => set("dueDate", e.target.value || null)}
            />
          </label>
        </>
      ) : null}
      {draft.kind === "note" ? (
        <>
          <label>
            {t("inbox.content")}
            <textarea
              className="field"
              value={draft.content}
              onChange={(e) => set("content", e.target.value)}
            />
          </label>
          <label>
            {t("inbox.tags")}
            <input
              className="field"
              value={draft.tags.join(", ")}
              onChange={(e) =>
                set(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        </>
      ) : null}
      {draft.kind === "event" ? (
        <>
          <label>
            {t("inbox.details")}
            <textarea
              className="field"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          <label>
            {t("inbox.date")}
            <input
              className="field"
              type="date"
              value={draft.date ?? ""}
              onChange={(e) => set("date", e.target.value || null)}
            />
          </label>
          <label>
            {t("inbox.time")}
            <input
              className="field"
              type="time"
              disabled={draft.allDay}
              value={draft.time ?? ""}
              onChange={(e) => set("time", e.target.value || null)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.allDay}
              onChange={(e) => set("allDay", e.target.checked)}
            />{" "}
            {t("inbox.allDay")}
          </label>
          <label>
            {t("inbox.timeZone")}
            <input
              className="field"
              value={draft.timeZone}
              onChange={(e) => set("timeZone", e.target.value)}
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
