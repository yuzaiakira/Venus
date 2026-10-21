import { TasksScreen } from "./tasks";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BrowserBookmarkPort,
  Library,
  Productivity,
} from "../application/productivity";
import { WorkspaceError } from "../domain/dashboard";
import { permissionNoteKey } from "../domain/commands";
import {
  applyBlockLink,
  canonicalHttpUrl,
  toggleBlockMark,
  convertBlock,
  type NoteText,
  plainText,
  searchFold,
  blockPlain,
  emptyDocument,
  folderCycle,
  iconFallback,
  replaceBlockText,
  safeLink,
  snapshotFromTree,
  type BrowserBookmarkNode,
  type NoteBlock,
  type NoteDocument,
  type NoteRecord,
  type NoteDraft,
} from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";

export function LibraryScreen(props: {
  view: "notes" | "tasks" | "bookmarks";
  library: Library;
  productivity: Productivity;
  bookmarks: BrowserBookmarkPort;
  locale: "en" | "fa";
  selectedNoteId?: string | null;
  selectedTaskId?: string | null;
  onSelectedNote?: (id: string) => void;
  onSelectedTask?: (id: string | null) => void;
  onEnrollReview?: (noteId: string) => Promise<void>;
}) {
  if (props.view === "notes")
    return (
      <NotesScreen
        library={props.library}
        productivity={props.productivity}
        locale={props.locale}
        selectedId={props.selectedNoteId ?? null}
        onSelected={props.onSelectedNote}
        onEnrollReview={props.onEnrollReview}
      />
    );
  if (props.view === "tasks")
    return (
      <TasksScreen
        library={props.library}
        productivity={props.productivity}
        locale={props.locale}
        selectedId={props.selectedTaskId ?? null}
        onSelected={props.onSelectedTask}
      />
    );
  return (
    <BookmarksScreen
      library={props.library}
      productivity={props.productivity}
      bookmarks={props.bookmarks}
      locale={props.locale}
    />
  );
}

function NotesScreen(props: {
  library: Library;
  productivity: Productivity;
  locale: "en" | "fa";
  selectedId: string | null;
  onSelected?: ((id: string) => void) | undefined;
  onEnrollReview?: ((noteId: string) => Promise<void>) | undefined;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [selected, setSelected] = useState<string | null>(props.selectedId);
  useEffect(() => {
    if (props.selectedId) setSelected(props.selectedId);
  }, [props.selectedId]);
  function selectNote(id: string) {
    setSelected(id);
    props.onSelected?.(id);
  }
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"active" | "archive" | "trash">("active");
  const [layout, setLayout] = useState<"list" | "grid">("grid");
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const folders = props.library.folders.filter(
    (folder) => folder.scope === "notes",
  );
  const notes = props.library.notes.filter((note) => {
    if (mode === "trash") return note.trashedAt !== null;
    if (note.trashedAt) return false;
    if (mode === "archive") return note.archived;
    return !note.archived;
  });
  const visible = notes
    .filter((note) => (folderId ? note.folderId === folderId : true))
    .filter((note) =>
      searchFold(
        `${note.title} ${plainText(note.body)} ${note.tags.join(" ")}`,
      ).includes(searchFold(query.trim())),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (a.sortIndex ?? 0) - (b.sortIndex ?? 0) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const current =
    props.library.notes.find((note) => note.id === selected) ?? null;
  return (
    <section
      className="card-glass content-card module"
      aria-label={t("nav.notes")}
    >
      <div className="page-header">
        <div>
          <span className="section-kicker">CAPTURE / 03</span>
          <h1>
            {t("nav.notes")} <span className="heading-star">✳</span>
          </h1>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() =>
            void props.productivity
              .createNote({
                title: t("notes.untitled"),
                body: emptyDocument(""),
                folderId,
              })
              .then((note) => {
                setMode("active");
                selectNote(note.id);
              })
              .catch(() => setError(t("notes.error")))
          }
        >
          {t("command.note")}
        </button>
      </div>
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => {
            const name = t("notes.folder");
            void props.productivity.createFolder("notes", name, folderId);
          }}
        >
          {t("notes.newFolder")}
        </button>
        <button className="btn" type="button" onClick={() => setLayout("list")}>
          {t("notes.list")}
        </button>
        <button className="btn" type="button" onClick={() => setLayout("grid")}>
          {t("notes.grid")}
        </button>
      </div>
      <FolderTree
        folders={folders}
        selected={folderId}
        locale={props.locale}
        onSelect={setFolderId}
        onRename={(id, revision, name) =>
          void props.productivity.updateFolder(id, revision, { name })
        }
        onMove={(id, revision, parentId) =>
          void props.productivity.updateFolder(id, revision, { parentId })
        }
        onDelete={(id, choice) =>
          void props.productivity.deleteFolder(id, choice)
        }
      />
      <label>
        {t("notes.search")}
        <input
          className="field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="cluster">
        {(["active", "archive", "trash"] as const).map((item) => (
          <button
            key={item}
            className="btn"
            type="button"
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
          >
            {t(`notes.${item}`)}
          </button>
        ))}
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className={layout === "grid" ? "note-grid" : "note-list"}>
        {visible.map((note, index) => (
          <li key={note.id} className="note-gallery-card card-glass">
            <button
              className="btn"
              type="button"
              onClick={() => selectNote(note.id)}
            >
              <bdi>{note.title}</bdi>
            </button>
            <p className="note-snippet">
              <bdi>{plainText(note.body).slice(0, 160)}</bdi>
            </p>
            <div className="cluster">
              {([-1, 1] as const).map((direction) => (
                <button
                  className="btn"
                  type="button"
                  key={direction}
                  aria-label={t(direction < 0 ? "repair.up" : "repair.down")}
                  disabled={
                    index + direction < 0 ||
                    index + direction >= visible.length ||
                    visible[index + direction]?.pinned !== note.pinned
                  }
                  onClick={() => {
                    const next = [...visible];
                    const other = next[index + direction];
                    if (!other) return;
                    next[index + direction] = note;
                    next[index] = other;
                    void props.productivity
                      .reorderNotes(next)
                      .catch(() => setError(t("notes.conflict")));
                  }}
                >
                  {direction < 0 ? "↑" : "↓"}
                </button>
              ))}
            </div>
            {note.tags.map((tag) => (
              <span key={tag} className="muted">
                <bdi>{tag}</bdi>
              </span>
            ))}
          </li>
        ))}
      </ul>
      {current ? (
        <NoteEditor
          key={current.id}
          note={current}
          locale={props.locale}
          productivity={props.productivity}
          folders={folders}
          onEnrollReview={props.onEnrollReview}
        />
      ) : (
        <p>{t("notes.empty")}</p>
      )}
    </section>
  );
}

function tagList(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function NoteEditor(props: {
  note: NoteRecord;
  folders: Library["folders"];
  locale: "en" | "fa";
  productivity: Productivity;
  onEnrollReview?: ((noteId: string) => Promise<void>) | undefined;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.note.title);
  const [body, setBody] = useState<NoteDocument>(props.note.body);
  const [tags, setTags] = useState(props.note.tags.join(", "));
  const [expected, setExpected] = useState(props.note.revision);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("saved");
  const [storedText, setStoredText] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const draftId = useRef(crypto.randomUUID());
  const [recoverable, setRecoverable] = useState<NoteDraft[]>([]);
  const draftQueue = useRef(Promise.resolve());
  function queueDraft(work: () => Promise<void>) {
    const pending = draftQueue.current.then(work, work);
    draftQueue.current = pending.catch(() => {});
    return pending;
  }
  function persistDraft() {
    const current = latest.current;
    if (!current.dirty) return Promise.resolve();
    const draft = {
      id: draftId.current,
      noteId: current.id,
      expectedRevision: expectedRef.current,
      title: current.title,
      body: current.body,
      tags: tagList(current.tags),
      updatedAt: new Date().toISOString(),
    };
    return queueDraft(() => props.productivity.saveNoteDraft(draft));
  }
  useEffect(() => {
    void props.productivity
      .noteDrafts(props.note.id)
      .then(setRecoverable)
      .catch(() => setStatus("error"));
  }, [props.productivity, props.note.id]);
  const expectedRef = useRef(props.note.revision);
  const chain = useRef(Promise.resolve());
  const latest = useRef({
    title,
    body,
    tags,
    dirty,
    status,
    id: props.note.id,
  });
  latest.current = { title, body, tags, dirty, status, id: props.note.id };
  function remember(revision: number) {
    expectedRef.current = revision;
    setExpected(revision);
  }
  function enqueue<T>(work: () => Promise<T>) {
    const run = chain.current.then(work, work);
    chain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
  function adopt(note: NoteRecord) {
    remember(note.revision);
    setTitle(note.title);
    setBody(note.body);
    setTags(note.tags.join(", "));
    setDirty(false);
    setStatus("saved");
    setStoredText("");
  }
  async function writeContent(revision: number) {
    const current = latest.current;
    const saved = await props.productivity.saveNote(current.id, revision, {
      title: current.title,
      body: current.body,
      tags: tagList(current.tags),
    });
    remember(saved.revision);
    if (
      latest.current.title === current.title &&
      latest.current.body === current.body &&
      latest.current.tags === current.tags
    ) {
      setDirty(false);
      setStatus("saved");
      await queueDraft(() =>
        props.productivity.removeNoteDraft(draftId.current),
      );
    } else {
      setStatus("idle");
    }
    return saved;
  }
  function scheduleSave() {
    return enqueue(async () => {
      const current = latest.current;
      if (!current.dirty || current.status === "conflict") return;
      setStatus("saving");
      try {
        await persistDraft();
        await writeContent(expectedRef.current);
      } catch (error) {
        if (error instanceof WorkspaceError && error.code === "conflict") {
          const library = await props.productivity.load();
          const stored = library.notes.find((note) => note.id === current.id);
          setStoredText(stored ? `${stored.title}\n${stored.updatedAt}` : "");
          setStatus("conflict");
          return;
        }
        setStatus("error");
      }
    });
  }
  function mutate(
    patch: Partial<
      Pick<
        NoteRecord,
        | "title"
        | "body"
        | "folderId"
        | "tags"
        | "pinned"
        | "archived"
        | "trashedAt"
      >
    >,
  ) {
    return enqueue(async () => {
      setStatus("saving");
      try {
        if (latest.current.dirty) await writeContent(expectedRef.current);
        const saved = await props.productivity.saveNote(
          latest.current.id,
          expectedRef.current,
          patch,
        );
        remember(saved.revision);
        setStatus("saved");
        return saved;
      } catch (error) {
        if (error instanceof WorkspaceError && error.code === "conflict") {
          const library = await props.productivity.load();
          const stored = library.notes.find(
            (note) => note.id === latest.current.id,
          );
          setStoredText(stored ? `${stored.title}\n${stored.updatedAt}` : "");
          setStatus("conflict");
          return;
        }
        setStatus("error");
      }
    });
  }
  useEffect(() => {
    if (!dirty) return;
    void persistDraft().catch(() => setStatus("error"));
  }, [title, body, tags, dirty]);
  useEffect(() => {
    if (
      !dirty ||
      status === "conflict" ||
      status === "error" ||
      status === "saving"
    )
      return;
    const handle = window.setTimeout(() => {
      void scheduleSave();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [dirty, title, body, tags, status]);
  useEffect(() => {
    // Adopt external updates only while the editor has no unsaved draft.
    if (!latest.current.dirty && props.note.revision > expectedRef.current)
      adopt(props.note);
  }, [props.note]);
  useEffect(
    () => () => {
      // Flush through the same queue. Failed drafts are not reported as saved.
      void persistDraft()
        .then(() => scheduleSave())
        .catch(() => {});
    },
    [props.note.id, props.productivity],
  );

  return (
    <form
      data-note-revision={expected}
      onSubmit={(event) => {
        event.preventDefault();
        void scheduleSave();
      }}
    >
      {recoverable.length ? (
        <div role="alert">
          <p>{t("notes.recoveredDraft")}</p>
          {recoverable.map((draft) => (
            <div key={draft.id}>
              <p>
                <bdi>{draft.title}</bdi> · {draft.updatedAt}
              </p>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setTitle(draft.title);
                  setBody(draft.body);
                  setTags(draft.tags.join(", "));
                  remember(draft.expectedRevision);
                  setDirty(true);
                  setStatus("idle");
                  setRecoverable([]);
                }}
              >
                {t("notes.restoreDraft")}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  void props.productivity
                    .removeNoteDraft(draft.id)
                    .then(() =>
                      setRecoverable((rows) =>
                        rows.filter((row) => row.id !== draft.id),
                      ),
                    )
                    .catch(() => setStatus("error"))
                }
              >
                {t("repair.delete")}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <p role="status" data-save-status={status}>
        {status === "saving" || status === "idle"
          ? t("notes.saving")
          : status === "saved"
            ? t("notes.saved")
            : status === "conflict"
              ? t("notes.conflict")
              : t("notes.error")}
      </p>
      {props.onEnrollReview ? (
        <div className="cluster">
          <button
            className="btn"
            type="button"
            onClick={() =>
              void props
                .onEnrollReview?.(props.note.id)
                .then(() => setReviewStatus(t("reviews.added")))
                .catch(() => setReviewStatus(t("reviews.saveFailed")))
            }
          >
            {t("notes.addToReview")}
          </button>
          {reviewStatus ? <span role="status">{reviewStatus}</span> : null}
        </div>
      ) : null}
      {status === "conflict" ? (
        <div>
          <p>
            <bdi>{storedText}</bdi>
          </p>
          <button
            className="btn"
            type="button"
            onClick={() =>
              void enqueue(async () => {
                const library = await props.productivity.load();
                const stored = library.notes.find(
                  (note) => note.id === latest.current.id,
                );
                if (!stored) {
                  setStatus("error");
                  return;
                }
                setStatus("saving");
                try {
                  await writeContent(stored.revision);
                } catch (error) {
                  if (
                    error instanceof WorkspaceError &&
                    error.code === "conflict"
                  ) {
                    setStoredText(`${stored.title}\n${stored.updatedAt}`);
                    setStatus("conflict");
                    return;
                  }
                  setStatus("error");
                }
              })
            }
          >
            {t("notes.keepDraft")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setDirty(false);
              void enqueue(async () => {
                const library = await props.productivity.load();
                const stored = library.notes.find(
                  (note) => note.id === latest.current.id,
                );
                if (!stored) {
                  setStatus("error");
                  return;
                }
                adopt(stored);
              });
            }}
          >
            {t("notes.useStored")}
          </button>
        </div>
      ) : null}
      <label>
        {t("capture.title")}
        <input
          className="field"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
        />
      </label>
      <label>
        {t("notes.tags")}
        <input
          className="field"
          value={tags}
          onChange={(event) => {
            setTags(event.target.value);
            setDirty(true);
          }}
        />
      </label>
      <label>
        {t("notes.folder")}
        <select
          className="select"
          value={props.note.folderId ?? ""}
          onChange={(event) =>
            void mutate({ folderId: event.target.value || null })
          }
        >
          <option value="">{t("notes.moveRoot")}</option>
          {props.folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <div className="cluster">
        <button className="btn primary" type="submit">
          {t("notes.save")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => void mutate({ pinned: !props.note.pinned })}
        >
          {props.note.pinned ? t("notes.unpin") : t("notes.pin")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            void mutate({
              archived: !props.note.archived,
              trashedAt: null,
            })
          }
        >
          {props.note.archived ? t("notes.restore") : t("notes.archive")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            void mutate({
              trashedAt: props.note.trashedAt ? null : new Date().toISOString(),
            })
          }
        >
          {props.note.trashedAt ? t("notes.restore") : t("notes.trash")}
        </button>
        {props.note.trashedAt ? (
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (window.confirm(t("repair.confirmDelete")))
                void props.productivity
                  .purgeNote(props.note.id)
                  .catch(() => setStatus("error"));
            }}
          >
            {t("notes.purge")}
          </button>
        ) : null}
      </div>
      {body.content.map((block, index) => (
        <BlockEditor
          key={index}
          block={block}
          locale={props.locale}
          onChange={(next) => {
            setBody({
              type: "doc",
              content: body.content.map((item, itemIndex) =>
                itemIndex === index ? next : item,
              ),
            });
            setDirty(true);
          }}
        />
      ))}
      <button
        className="btn"
        type="button"
        onClick={() => {
          setBody({
            type: "doc",
            content: [...body.content, { type: "paragraph", content: [] }],
          });
          setDirty(true);
        }}
      >
        {t("notes.addBlock")}
      </button>
    </form>
  );
}

function blockLink(block: NoteBlock) {
  const nodes =
    block.type === "paragraph" || block.type === "heading"
      ? block.content
      : (block.content[0]?.content ?? []);
  const link = nodes[0]?.marks?.find((mark) => mark.type === "link");
  return link && link.type === "link" ? link.href : "";
}

function BlockEditor(props: {
  block: NoteBlock;
  locale: "en" | "fa";
  onChange: (block: NoteBlock) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const text = blockPlain(props.block);
  const [href, setHref] = useState(blockLink(props.block));
  const [linkError, setLinkError] = useState("");
  return (
    <div>
      <label>
        {t("notes.block")}
        <select
          className="select"
          value={props.block.type}
          onChange={(event) => {
            props.onChange(
              convertBlock(
                props.block,
                event.target.value as NoteBlock["type"],
              ),
            );
          }}
        >
          <option value="paragraph">{t("notes.paragraph")}</option>
          <option value="heading">{t("notes.heading")}</option>
          <option value="bulletList">{t("notes.bullets")}</option>
          <option value="orderedList">{t("notes.ordered")}</option>
          <option value="taskList">{t("notes.checklist")}</option>
        </select>
      </label>
      <textarea
        className="field"
        aria-label={t("notes.block")}
        value={text}
        onChange={(event) => {
          props.onChange(replaceBlockText(props.block, event.target.value));
        }}
      />
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => props.onChange(toggleBlockMark(props.block, "bold"))}
        >
          {t("notes.bold")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => props.onChange(toggleBlockMark(props.block, "italic"))}
        >
          {t("notes.italic")}
        </button>
        <label>
          {t("notes.linkHref")}
          <input
            className="field"
            value={href}
            onChange={(event) => setHref(event.target.value)}
          />
        </label>
        <button
          className="btn"
          type="button"
          onClick={() => {
            try {
              props.onChange(applyBlockLink(props.block, href));
              setLinkError("");
            } catch {
              setLinkError(t("notes.linkRejected"));
            }
          }}
        >
          {t("notes.link")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            props.onChange(applyBlockLink(props.block, null));
            setHref("");
            setLinkError("");
          }}
        >
          {t("notes.removeLink")}
        </button>
      </div>
      {linkError ? <p className="error">{linkError}</p> : null}
      {props.block.type === "taskList"
        ? props.block.content.map((item, index) => (
            <label className="cluster" key={index}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => {
                  if (props.block.type !== "taskList") return;
                  props.onChange({
                    ...props.block,
                    content: props.block.content.map((row, i) =>
                      i === index
                        ? { ...row, checked: event.target.checked }
                        : row,
                    ),
                  });
                }}
              />
              <bdi>{item.content.map((node) => node.text).join("")}</bdi>
            </label>
          ))
        : null}
      <DocumentView document={{ type: "doc", content: [props.block] }} />
    </div>
  );
}

export function DocumentView(props: { document: NoteDocument }) {
  return (
    <div>
      {props.document.content.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function InlineText(props: { nodes: NoteText[] }) {
  return (
    <>
      {props.nodes.map((node, index) => {
        const marks = node.marks ?? [];
        let content = <bdi>{node.text}</bdi>;
        if (marks.some((mark) => mark.type === "bold"))
          content = <strong>{content}</strong>;
        if (marks.some((mark) => mark.type === "italic"))
          content = <em>{content}</em>;
        const link = marks.find((mark) => mark.type === "link");
        if (link?.type === "link") {
          try {
            content = (
              <a
                href={safeLink(link.href)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            );
          } catch {
            /* Invalid links render as inert text. */
          }
        }
        return <span key={index}>{content}</span>;
      })}
    </>
  );
}
function BlockView(props: { block: NoteBlock }) {
  const block = props.block;
  if (block.type === "paragraph")
    return (
      <p className="note-text">
        <InlineText nodes={block.content} />
      </p>
    );
  if (block.type === "heading")
    return (
      <h3>
        <InlineText nodes={block.content} />
      </h3>
    );
  if (block.type === "taskList")
    return (
      <ul className="checklist">
        {block.content.map((item, index) => (
          <li key={index}>
            <input
              type="checkbox"
              checked={item.checked}
              readOnly
              aria-label={item.content.map((node) => node.text).join("")}
            />
            <InlineText nodes={item.content} />
          </li>
        ))}
      </ul>
    );
  const items = block.content.map((item, index) => (
    <li key={index}>
      <InlineText nodes={item.content} />
    </li>
  ));
  return block.type === "orderedList" ? <ol>{items}</ol> : <ul>{items}</ul>;
}

function FolderTree(props: {
  folders: Library["folders"];
  selected: string | null;
  locale: "en" | "fa";
  onSelect: (id: string | null) => void;
  onRename: (id: string, revision: number, name: string) => void;
  onMove: (id: string, revision: number, parentId: string | null) => void;
  onDelete: (id: string, mode: "move" | "deleteContents") => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const roots = props.folders
    .filter((folder) => folder.parentId === null)
    .sort((a, b) => a.sortIndex - b.sortIndex);
  return (
    <div>
      <button
        className="btn"
        type="button"
        onClick={() => props.onSelect(null)}
      >
        {t("notes.allFolders")}
      </button>
      <ul>
        {roots.map((folder) => (
          <FolderNode
            key={folder.id}
            folderId={folder.id}
            folders={props.folders}
            selected={props.selected}
            locale={props.locale}
            onSelect={props.onSelect}
            onRename={props.onRename}
            onMove={props.onMove}
            onDelete={props.onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

function FolderNode(props: {
  folderId: string;
  folders: Library["folders"];
  selected: string | null;
  locale: "en" | "fa";
  onSelect: (id: string | null) => void;
  onRename: (id: string, revision: number, name: string) => void;
  onMove: (id: string, revision: number, parentId: string | null) => void;
  onDelete: (id: string, mode: "move" | "deleteContents") => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const folder = props.folders.find((item) => item.id === props.folderId);
  const [name, setName] = useState(folder?.name ?? "");
  const [confirm, setConfirm] = useState<"move" | "deleteContents" | null>(
    null,
  );
  if (!folder) return null;
  const children = props.folders
    .filter((item) => item.parentId === folder.id)
    .sort((a, b) => a.sortIndex - b.sortIndex);
  return (
    <li>
      <button
        className="btn"
        type="button"
        aria-pressed={props.selected === folder.id}
        onClick={() => props.onSelect(folder.id)}
      >
        <bdi>{folder.name}</bdi>
      </button>
      <input
        className="field"
        aria-label={t("notes.rename")}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <button
        className="btn"
        type="button"
        onClick={() => props.onRename(folder.id, folder.revision, name)}
      >
        {t("notes.rename")}
      </button>
      <label>
        {t("notes.parent")}
        <select
          className="select"
          value={folder.parentId ?? ""}
          onChange={(event) =>
            props.onMove(
              folder.id,
              folder.revision,
              event.target.value ? event.target.value : null,
            )
          }
        >
          <option value="">{t("notes.moveRoot")}</option>
          {props.folders
            .filter(
              (candidate) =>
                candidate.id !== folder.id &&
                !folderCycle(props.folders, folder.id, candidate.id),
            )
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
        </select>
      </label>
      <button className="btn" type="button" onClick={() => setConfirm("move")}>
        {t("notes.deleteMove")}
      </button>
      <button
        className="btn"
        type="button"
        onClick={() => setConfirm("deleteContents")}
      >
        {t("notes.deleteTree")}
      </button>
      {confirm ? (
        <button
          className="btn"
          type="button"
          onClick={() => {
            props.onDelete(folder.id, confirm);
            setConfirm(null);
          }}
        >
          {t("settings.confirm")}
        </button>
      ) : null}
      {children.length > 0 ? (
        <ul>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folderId={child.id}
              folders={props.folders}
              selected={props.selected}
              locale={props.locale}
              onSelect={props.onSelect}
              onRename={props.onRename}
              onMove={props.onMove}
              onDelete={props.onDelete}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function BookmarksScreen(props: {
  library: Library;
  productivity: Productivity;
  bookmarks: BrowserBookmarkPort;
  locale: "en" | "fa";
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState("");
  const [tree, setTree] = useState<BrowserBookmarkNode[]>([]);
  const [access, setAccess] = useState<
    "granted" | "missing" | "unsupported" | ""
  >("");
  const [permissionNote, setPermissionNote] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [removeArmed, setRemoveArmed] = useState("");
  const folders = props.library.folders.filter(
    (folder) => folder.scope === "localBookmarks",
  );
  useEffect(() => {
    void props.productivity
      .readBrowser(props.bookmarks)
      .then((result) => {
        setAccess(result.access);
        setTree(result.tree);
      })
      .catch(() => setError(t("bookmarks.rejected")));
  }, [props.bookmarks, props.productivity]);
  const quick = useMemo(
    () =>
      props.library.bookmarks
        .filter((bookmark) => bookmark.quick)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [props.library.bookmarks],
  );
  return (
    <section
      className="card-glass content-card module"
      aria-label={t("nav.bookmarks")}
    >
      <div className="page-header">
        <div>
          <span className="section-kicker">EXPLORE / 05</span>
          <h1>
            {t("nav.bookmarks")} <span className="heading-star">✳</span>
          </h1>
        </div>
      </div>
      <label>
        {t("notes.search")}
        <input
          className="field"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <h3>{t("bookmarks.local")}</h3>
      <div className="icon-grid">
        {quick.map((bookmark) => (
          <a key={bookmark.id} href={bookmark.url}>
            <bdi>{iconFallback(bookmark.title, bookmark.iconLabel)}</bdi>
            <bdi>{bookmark.title}</bdi>
          </a>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void props.productivity
            .createBookmark({ title, url, folderId, quick: true })
            .then(() => {
              setTitle("");
              setUrl("https://");
            })
            .catch(() => setError(t("bookmarks.rejected")));
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
          {t("bookmarks.url")}
          <input
            className="field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label>
          {t("bookmarks.folder")}
          <select
            className="select"
            value={folderId ?? ""}
            onChange={(event) => setFolderId(event.target.value || null)}
          >
            <option value="">{t("notes.allFolders")}</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn primary" type="submit">
          {t("bookmarks.create")}
        </button>
      </form>
      <button
        className="btn"
        type="button"
        onClick={() =>
          void props.productivity.createFolder(
            "localBookmarks",
            t("notes.folder"),
            folderId,
          )
        }
      >
        {t("bookmarks.newFolder")}
      </button>
      {error ? <p className="error">{error}</p> : null}
      <ul>
        {props.library.bookmarks
          .filter(
            (row) =>
              (!folderId || row.folderId === folderId) &&
              searchFold(`${row.title} ${row.url}`).includes(searchFold(query)),
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((bookmark) => (
            <BookmarkRow
              key={bookmark.id}
              bookmark={bookmark}
              folders={folders}
              locale={props.locale}
              armed={removeArmed === bookmark.id}
              productivity={props.productivity}
              onArm={() => setRemoveArmed(bookmark.id)}
              onMove={(direction) => {
                const rows = [...props.library.bookmarks].sort(
                  (a, b) => a.sortOrder - b.sortOrder,
                );
                const index = rows.findIndex((row) => row.id === bookmark.id);
                const other = rows[index + direction];
                if (!other) return;
                rows[index + direction] = bookmark;
                rows[index] = other;
                void props.productivity
                  .reorderBookmarks(rows)
                  .catch(() => setError(t("bookmarks.rejected")));
              }}
            />
          ))}
      </ul>
      <FolderTree
        folders={folders}
        selected={folderId}
        locale={props.locale}
        onSelect={setFolderId}
        onRename={(id, revision, name) =>
          void props.productivity.updateFolder(id, revision, { name })
        }
        onMove={(id, revision, parentId) =>
          void props.productivity.updateFolder(id, revision, { parentId })
        }
        onDelete={(id, choice) =>
          void props.productivity.deleteFolder(id, choice)
        }
      />
      <h3>{t("bookmarks.browser")}</h3>
      <p>
        {access === "granted" ? t("bookmarks.active") : t("bookmarks.inactive")}
      </p>
      <p role="status">{permissionNote}</p>
      <button
        className="btn"
        type="button"
        onClick={() =>
          void props.productivity
            .requestBrowser(props.bookmarks)
            .then(async (outcome) => {
              setPermissionNote(t(permissionNoteKey(outcome)));
              const next = await props.productivity.readBrowser(
                props.bookmarks,
              );
              setAccess(next.access);
              setTree(next.tree);
            })
        }
      >
        {t("onboarding.request")}
      </button>
      <button
        className="btn"
        type="button"
        onClick={() =>
          void props.productivity
            .revokeBrowser(props.bookmarks)
            .then(async (outcome) => {
              setPermissionNote(
                outcome === "revoked"
                  ? t("bookmarks.revoked")
                  : outcome === "unsupported"
                    ? t("onboarding.unsupported")
                    : t("onboarding.failed"),
              );
              const next = await props.productivity.readBrowser(
                props.bookmarks,
              );
              setAccess(next.access);
              setTree(next.tree);
            })
        }
      >
        {t("bookmarks.revoke")}
      </button>
      {access === "granted" ? (
        <BrowserTree nodes={tree} locale={props.locale} />
      ) : null}
      {access === "granted" ? (
        <BrowserEditor
          locale={props.locale}
          nodes={tree}
          confirmId={confirmId}
          onConfirm={setConfirmId}
          onCreate={(parentId, nextTitle, nextUrl, confirmed) =>
            void props.productivity
              .changeBrowser(props.bookmarks, confirmed, () =>
                props.bookmarks.create({
                  parentId,
                  title: nextTitle,
                  url: nextUrl || null,
                }),
              )
              .then(() => props.productivity.readBrowser(props.bookmarks))
              .then((next) => {
                setTree(next.tree);
                setAccess(next.access);
              })
              .catch(() => setError(t("bookmarks.rejected")))
          }
          onUpdate={(id, title, url, confirmed) =>
            void props.productivity
              .changeBrowser(props.bookmarks, confirmed, () =>
                props.bookmarks.update(id, { title, ...(url ? { url } : {}) }),
              )
              .then(() => props.productivity.readBrowser(props.bookmarks))
              .then((next) => {
                setTree(next.tree);
                setAccess(next.access);
              })
              .catch(() => setError(t("bookmarks.rejected")))
          }
          onMove={(id, parentId, confirmed) =>
            void props.productivity
              .changeBrowser(props.bookmarks, confirmed, () =>
                props.bookmarks.move(id, parentId),
              )
              .then(() => props.productivity.readBrowser(props.bookmarks))
              .then((next) => {
                setTree(next.tree);
                setAccess(next.access);
              })
              .catch(() => setError(t("bookmarks.rejected")))
          }
          onRemove={(id, confirmed) =>
            void props.productivity
              .changeBrowser(props.bookmarks, confirmed, () =>
                props.bookmarks.remove(id),
              )
              .then(() => props.productivity.readBrowser(props.bookmarks))
              .then((next) => {
                setTree(next.tree);
                setAccess(next.access);
              })
              .catch(() => setError(t("bookmarks.rejected")))
          }
        />
      ) : null}
      <button
        className="btn"
        type="button"
        onClick={() => {
          if (access !== "granted") return;
          const rows = snapshotFromTree(
            tree,
            "browser",
            new Date().toISOString(),
            () => crypto.randomUUID(),
          );
          void props.productivity
            .replaceSnapshots(rows)
            .then(() => {
              const href = URL.createObjectURL(
                new Blob(
                  [
                    JSON.stringify(
                      { format: "venus-bookmarks-snapshot", version: 1, rows },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
              );
              const link = document.createElement("a");
              link.href = href;
              link.download = "venus-bookmarks-snapshot.json";
              link.click();
              window.setTimeout(() => URL.revokeObjectURL(href), 1000);
            })
            .catch(() => setError(t("bookmarks.rejected")));
        }}
      >
        {t("bookmarks.export")}
      </button>
      <p>{t("bookmarks.snapshotCount")}</p>
      <ul>
        {props.library.snapshots.map((row) => (
          <li key={row.id}>
            <bdi>{row.portablePath}</bdi>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookmarkRow(props: {
  bookmark: Library["bookmarks"][number];
  folders: Library["folders"];
  locale: "en" | "fa";
  armed: boolean;
  productivity: Productivity;
  onArm: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.bookmark.title);
  const [url, setUrl] = useState(props.bookmark.url);
  const [folderId, setFolderId] = useState(props.bookmark.folderId);
  const [quick, setQuick] = useState(props.bookmark.quick);
  const [expected, setExpected] = useState(props.bookmark.revision);
  const [error, setError] = useState("");
  return (
    <li>
      <div className="cluster">
        <button
          className="btn"
          type="button"
          aria-label={t("repair.up")}
          onClick={() => props.onMove(-1)}
        >
          ↑
        </button>
        <button
          className="btn"
          type="button"
          aria-label={t("repair.down")}
          onClick={() => props.onMove(1)}
        >
          ↓
        </button>
      </div>
      <span className="muted">{t("bookmarks.sourceVenus")}</span>
      <a href={props.bookmark.url}>
        <bdi>{props.bookmark.title}</bdi>
      </a>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void props.productivity
            .saveBookmark(props.bookmark.id, expected, {
              title,
              url,
              folderId,
              quick,
            })
            .then((saved) => {
              setExpected(saved.revision);
              setTitle(saved.title);
              setUrl(saved.url);
              setFolderId(saved.folderId);
              setQuick(saved.quick);
            })
            .catch(() => setError(t("bookmarks.rejected")));
        }}
      >
        <label>
          {t("bookmarks.edit")}
          <input
            className="field"
            aria-label={t("capture.title")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t("bookmarks.url")}
          <input
            className="field"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label>
          {t("bookmarks.folder")}
          <select
            className="select"
            value={folderId ?? ""}
            onChange={(event) => setFolderId(event.target.value || null)}
          >
            <option value="">{t("notes.allFolders")}</option>
            {props.folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={quick}
            onChange={(event) => setQuick(event.target.checked)}
          />
          {t("bookmarks.quick")}
        </label>
        <button className="btn" type="submit">
          {t("bookmarks.save")}
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn" type="button" onClick={props.onArm}>
        {t("bookmarks.confirmRemove")}
      </button>
      <button
        className="btn"
        type="button"
        disabled={!props.armed}
        onClick={() =>
          void props.productivity
            .deleteBookmark(props.bookmark.id, props.bookmark.revision)
            .catch(() => setError(t("bookmarks.rejected")))
        }
      >
        {t("edit.remove")}
      </button>
    </li>
  );
}

function BrowserTree(props: {
  nodes: BrowserBookmarkNode[];
  locale: "en" | "fa";
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  return (
    <ul>
      {props.nodes.map((node) => (
        <li key={node.id}>
          <span className="muted">{t("bookmarks.sourceBrowser")}</span>
          {safeBookmarkUrl(node.url) ? (
            <a
              href={safeBookmarkUrl(node.url)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <bdi>{node.title}</bdi>
            </a>
          ) : (
            <bdi>{node.title}</bdi>
          )}
          {node.children ? (
            <BrowserTree nodes={node.children} locale={props.locale} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function safeBookmarkUrl(value?: string) {
  if (!value) return null;
  try {
    return canonicalHttpUrl(value);
  } catch {
    return null;
  }
}
function BrowserEditor(props: {
  locale: "en" | "fa";
  nodes: BrowserBookmarkNode[];
  confirmId: string;
  onConfirm: (id: string) => void;
  onCreate: (
    parentId: string | null,
    title: string,
    url: string,
    confirmed: boolean,
  ) => void;
  onRemove: (id: string, confirmed: boolean) => void;
  onUpdate: (
    id: string,
    title: string,
    url: string,
    confirmed: boolean,
  ) => void;
  onMove: (id: string, parentId: string, confirmed: boolean) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [selected, setSelected] = useState("");
  const [parent, setParent] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const rows: BrowserBookmarkNode[] = [];
  function walk(nodes: BrowserBookmarkNode[]) {
    for (const node of nodes) {
      rows.push(node);
      walk(node.children ?? []);
    }
  }
  walk(props.nodes);
  // Exclude the synthetic browser root and built-in containers from destructive editing.
  const editable = rows.filter(
    (node) =>
      !props.nodes.some((root) => root.id === node.id) &&
      !props.nodes.some((root) =>
        root.children?.some((child) => child.id === node.id),
      ),
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onCreate(parent || null, title, url, confirmed);
      }}
    >
      <p>{t("bookmarks.confirmHelp")}</p>
      <label>
        {t("bookmarks.target")}
        <select
          className="select"
          value={selected}
          onChange={(event) => {
            const id = event.target.value;
            setSelected(id);
            props.onConfirm("");
            const node = editable.find((row) => row.id === id);
            setTitle(node?.title ?? "");
            setUrl(node?.url ?? "");
          }}
        >
          <option value="">{t("bookmarks.createBrowser")}</option>
          {editable.map((node) => (
            <option key={node.id} value={node.id}>
              {node.title || node.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("bookmarks.folder")}
        <select
          className="select"
          value={parent}
          onChange={(event) => setParent(event.target.value)}
        >
          <option value="">{t("notes.moveRoot")}</option>
          {rows
            .filter(
              (row) =>
                !row.url &&
                row.id !== selected &&
                !props.nodes.some((root) => root.id === row.id),
            )
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.title || row.id}
              </option>
            ))}
        </select>
      </label>
      <label className="cluster">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        {t("bookmarks.confirm")}
      </label>
      <label>
        {t("capture.title")}
        <input
          className="field"
          value={title}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        {t("bookmarks.url")}
        <input
          className="field"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </label>
      <div className="cluster">
        <button
          className="btn"
          type="submit"
          disabled={!confirmed || !title.trim()}
        >
          {t("bookmarks.createBrowser")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!confirmed || !selected || !title.trim()}
          onClick={() => props.onUpdate(selected, title, url, confirmed)}
        >
          {t("bookmarks.save")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!confirmed || !selected || !parent}
          onClick={() => props.onMove(selected, parent, confirmed)}
        >
          {t("bookmarks.move")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!selected}
          onClick={() => props.onConfirm(selected)}
        >
          {t("bookmarks.confirmDelete")}
        </button>
        <button
          className="btn"
          type="button"
          disabled={!confirmed || !selected || props.confirmId !== selected}
          onClick={() => {
            props.onRemove(selected, true);
            props.onConfirm("");
            setSelected("");
          }}
        >
          {t("bookmarks.deleteBrowser")}
        </button>
      </div>
    </form>
  );
}
