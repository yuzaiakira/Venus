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
} from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";

export function LibraryScreen(props: {
  view: "notes" | "tasks" | "bookmarks";
  library: Library;
  productivity: Productivity;
  bookmarks: BrowserBookmarkPort;
  locale: "en" | "fa";
}) {
  if (props.view === "notes")
    return (
      <NotesScreen
        library={props.library}
        productivity={props.productivity}
        locale={props.locale}
      />
    );
  if (props.view === "tasks")
    return (
      <TasksScreen
        library={props.library}
        productivity={props.productivity}
        locale={props.locale}
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
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"active" | "archive" | "trash">("active");
  const [layout, setLayout] = useState<"list" | "grid">("list");
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
      `${note.title} ${note.tags.join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );
  const current =
    props.library.notes.find((note) => note.id === selected) ?? null;
  return (
    <section className="card-glass content-card module" aria-label={t("nav.notes")}>
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
              .then((note) => setSelected(note.id))
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
      <ul className={layout === "grid" ? "note-grid" : "note-list"}>
        {visible.map((note) => (
          <li key={note.id}>
            <button
              className="btn"
              type="button"
              onClick={() => setSelected(note.id)}
            >
              <bdi>{note.title}</bdi>
            </button>
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
  locale: "en" | "fa";
  productivity: Productivity;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.note.title);
  const [body, setBody] = useState<NoteDocument>(props.note.body);
  const [tags, setTags] = useState(props.note.tags.join(", "));
  const [expected, setExpected] = useState(props.note.revision);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("saved");
  const [storedText, setStoredText] = useState("");
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
    }
    return saved;
  }
  function scheduleSave() {
    return enqueue(async () => {
      const current = latest.current;
      if (!current.dirty || current.status === "conflict") return;
      setStatus("saving");
      try {
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
    if (!dirty || status === "conflict") return;
    const handle = window.setTimeout(() => {
      void scheduleSave();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [dirty, title, body, tags, status]);
  useEffect(() => {
    return () => {
      const current = latest.current;
      if (!current.dirty || current.status === "conflict") return;
      void props.productivity.saveNote(current.id, expectedRef.current, {
        title: current.title,
        body: current.body,
        tags: tagList(current.tags),
      });
    };
  }, [props.note.id, props.productivity]);
  return (
    <form
      data-note-revision={expected}
      onSubmit={(event) => {
        event.preventDefault();
        void scheduleSave();
      }}
    >
      <p role="status" data-save-status={status}>
        {status === "saving"
          ? t("notes.saving")
          : status === "saved"
            ? t("notes.saved")
            : status === "conflict"
              ? t("notes.conflict")
              : t("notes.error")}
      </p>
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
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => void mutate({ pinned: !props.note.pinned })}
        >
          {t("notes.pin")}
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
          {t("notes.archive")}
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
            onClick={() => void props.productivity.purgeNote(props.note.id)}
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
            const type = event.target.value;
            if (type === "heading")
              props.onChange({ type: "heading", level: 2, content: [] });
            else if (type === "bulletList" || type === "orderedList")
              props.onChange({ type, content: [] });
            else if (type === "taskList")
              props.onChange({
                type: "taskList",
                content: [{ type: "taskItem", checked: false, content: [] }],
              });
            else props.onChange({ type: "paragraph", content: [] });
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
        value={text}
        onChange={(event) => {
          props.onChange(replaceBlockText(props.block, event.target.value));
        }}
      />
      <div className="cluster">
        <button
          className="btn"
          type="button"
          onClick={() => props.onChange(toggleMark(props.block, "bold"))}
        >
          {t("notes.bold")}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => props.onChange(toggleMark(props.block, "italic"))}
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
      <DocumentView document={{ type: "doc", content: [props.block] }} />
    </div>
  );
}

function toggleMark(block: NoteBlock, mark: "bold" | "italic"): NoteBlock {
  const text = blockPlain(block);
  const source =
    block.type === "paragraph" || block.type === "heading"
      ? block.content[0]
      : block.content[0]?.content[0];
  const marks = source?.marks ?? [];
  const next = marks.some((item) => item.type === mark)
    ? marks.filter((item) => item.type !== mark)
    : [...marks, { type: mark }];
  const content = text ? [{ type: "text" as const, text, marks: next }] : [];
  if (block.type === "paragraph" || block.type === "heading")
    return { ...block, content };
  if (block.type === "taskList")
    return {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          checked: block.content[0]?.checked ?? false,
          content,
        },
      ],
    };
  return { type: block.type, content: [{ type: "listItem", content }] };
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

function BlockView(props: { block: NoteBlock }) {
  const text =
    props.block.type === "paragraph" || props.block.type === "heading"
      ? props.block.content
      : (props.block.content[0]?.content ?? []);
  const marks = text[0]?.marks ?? [];
  const value = text.map((node) => node.text).join("");
  const link = marks.find((mark) => mark.type === "link");
  const style = {
    fontWeight: marks.some((mark) => mark.type === "bold") ? 700 : 400,
    fontStyle: marks.some((mark) => mark.type === "italic")
      ? "italic"
      : "normal",
  };
  let href: string | null = null;
  if (link && link.type === "link") {
    try {
      href = safeLink(link.href);
    } catch {
      href = null;
    }
  }
  if (href) {
    return (
      <p style={style}>
        <a href={href}>
          <bdi>{value}</bdi>
        </a>
      </p>
    );
  }
  if (props.block.type === "heading")
    return (
      <h3 style={style}>
        <bdi>{value}</bdi>
      </h3>
    );
  if (props.block.type === "taskList") {
    const checked = props.block.content[0]?.checked ?? false;
    return (
      <p style={style}>
        <input type="checkbox" checked={checked} readOnly /> <bdi>{value}</bdi>
      </p>
    );
  }
  return (
    <p style={style}>
      <bdi>{value}</bdi>
    </p>
  );
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

function TasksScreen(props: {
  library: Library;
  productivity: Productivity;
  locale: "en" | "fa";
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const tasks = props.library.tasks.filter((task) =>
    filter === "all" ? true : task.status === filter,
  );
  return (
    <section className="card-glass content-card module" aria-label={t("nav.tasks")}>
      <div className="page-header">
        <div>
          <span className="section-kicker">ORGANIZE / 02</span>
          <h1>
            {t("nav.tasks")} <span className="heading-star">✳</span>
          </h1>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          void props.productivity.createTask(title).then(() => setTitle(""));
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
        <button className="btn primary" type="submit">
          {t("command.task")}
        </button>
      </form>
      <div className="cluster">
        {(["open", "done", "all"] as const).map((item) => (
          <button
            key={item}
            className="btn"
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {t(`tasks.${item}`)}
          </button>
        ))}
      </div>
      <ul>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            locale={props.locale}
            productivity={props.productivity}
          />
        ))}
      </ul>
    </section>
  );
}

function TaskCard(props: {
  task: Library["tasks"][number];
  locale: "en" | "fa";
  productivity: Productivity;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.task.title);
  const [details, setDetails] = useState(props.task.details);
  const [priority, setPriority] = useState(props.task.priority);
  const [expected, setExpected] = useState(props.task.revision);
  const [error, setError] = useState("");
  async function save(
    patch: Partial<
      Pick<
        Library["tasks"][number],
        | "title"
        | "details"
        | "status"
        | "priority"
        | "dueDate"
        | "eventId"
        | "focusRank"
      >
    >,
  ) {
    try {
      const saved = await props.productivity.saveTask(props.task.id, expected, {
        title,
        details,
        priority,
        ...patch,
      });
      setExpected(saved.revision);
      setTitle(saved.title);
      setDetails(saved.details);
      setPriority(saved.priority);
      setError("");
    } catch {
      setError(t("tasks.invalid"));
    }
  }
  return (
    <li>
      <bdi>{props.task.title}</bdi>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save({ title, details, priority });
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
          {t("tasks.details")}
          <textarea
            className="field"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        <label>
          {t("tasks.priority")}
          <select
            className="select"
            value={priority}
            onChange={(event) =>
              setPriority(Number(event.target.value) as 1 | 2 | 3)
            }
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <button className="btn" type="submit">
          {t("tasks.save")}
        </button>
      </form>
      <button
        className="btn"
        type="button"
        onClick={() =>
          void save({ status: props.task.status === "done" ? "open" : "done" })
        }
      >
        {props.task.status === "done" ? t("tasks.open") : t("tasks.done")}
      </button>
      <label>
        {t("tasks.due")}
        <input
          className="field"
          value={props.task.dueDate ?? ""}
          onChange={(event) =>
            void save({ dueDate: event.target.value || null })
          }
        />
      </label>
      <label>
        {t("tasks.focus")}
        <select
          className="select"
          value={props.task.focusRank ?? ""}
          onChange={(event) =>
            void save({
              focusRank: event.target.value
                ? (Number(event.target.value) as 1 | 2 | 3)
                : null,
            })
          }
        >
          <option value="">{t("tasks.none")}</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </label>
      <label>
        {t("tasks.event")}
        <input
          className="field"
          value={props.task.eventId ?? ""}
          onChange={(event) =>
            void save({ eventId: event.target.value || null })
          }
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
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
    void props.productivity.readBrowser(props.bookmarks).then((result) => {
      setAccess(result.access);
      setTree(result.tree);
    });
  }, [props.bookmarks, props.productivity]);
  const quick = useMemo(
    () => props.library.bookmarks.filter((bookmark) => bookmark.quick),
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
        {props.library.bookmarks.map((bookmark) => (
          <BookmarkRow
            key={bookmark.id}
            bookmark={bookmark}
            folders={folders}
            locale={props.locale}
            armed={removeArmed === bookmark.id}
            productivity={props.productivity}
            onArm={() => setRemoveArmed(bookmark.id)}
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
              .then((next) => setTree(next.tree))
          }
          onRemove={(id, confirmed) =>
            void props.productivity
              .changeBrowser(props.bookmarks, confirmed, () =>
                props.bookmarks.remove(id),
              )
              .then(() => props.productivity.readBrowser(props.bookmarks))
              .then((next) => setTree(next.tree))
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
          void props.productivity.replaceSnapshots(rows);
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
          void props.productivity.deleteBookmark(props.bookmark.id)
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
          {node.url ? (
            <a href={node.url}>
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
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        props.onCreate(null, title, url, confirmed);
      }}
    >
      <p>{t("bookmarks.confirmHelp")}</p>
      <label>
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
      <button className="btn" type="submit" disabled={!confirmed}>
        {t("bookmarks.createBrowser")}
      </button>
      {props.nodes[0] ? (
        <button
          className="btn"
          type="button"
          disabled={props.confirmId !== props.nodes[0].id}
          onClick={() => {
            const node = props.nodes[0];
            if (node) props.onRemove(node.id, true);
          }}
        >
          {t("bookmarks.deleteBrowser")}
        </button>
      ) : null}
      {props.nodes[0] ? (
        <button
          className="btn"
          type="button"
          onClick={() => {
            const node = props.nodes[0];
            if (node) props.onConfirm(node.id);
          }}
        >
          {t("bookmarks.confirmDelete")}
        </button>
      ) : null}
    </form>
  );
}
