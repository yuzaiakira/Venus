import type { WorkspaceChange } from "./workspace";
import { WorkspaceError } from "../domain/dashboard";
import {
  bookmarkSnapshotSchema,
  canonicalHttpUrl,
  descendantIds,
  folderCycle,
  folderSchema,
  habitSchema,
  localBookmarkSchema,
  normalizeTags,
  noteSchema,
  optionalEventId,
  taskSchema,
  taskColumn,
  sortedTasks,
  type TaskColumn,
  validDueDate,
  validateNoteDocument,
  type BookmarkSnapshotRecord,
  type BrowserBookmarkNode,
  type FolderRecord,
  type HabitRecord,
  type LocalBookmarkRecord,
  type NoteDocument,
  type NoteRecord,
  type NoteDraft,
  type TaskRecord,
} from "../domain/productivity";

export interface RowTable<T> {
  get(id: string): Promise<T | undefined>;
  put(row: T): Promise<unknown>;
  delete(id: string): Promise<void>;
  toArray(): Promise<T[]>;
  clear(): Promise<void>;
}
export interface ProductivityDatabase {
  notes: RowTable<NoteRecord>;
  noteDrafts: RowTable<NoteDraft>;
  folders: RowTable<FolderRecord>;
  tasks: RowTable<TaskRecord>;
  localBookmarks: RowTable<LocalBookmarkRecord>;
  bookmarkSnapshots: RowTable<BookmarkSnapshotRecord>;
  habits: RowTable<HabitRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}
export interface Library {
  notes: NoteRecord[];
  folders: FolderRecord[];
  tasks: TaskRecord[];
  bookmarks: LocalBookmarkRecord[];
  snapshots: BookmarkSnapshotRecord[];
  habits: HabitRecord[];
}
export type BookmarkAccess = "granted" | "missing" | "unsupported";
export interface BrowserBookmarkPort {
  permission(): Promise<BookmarkAccess>;
  tree(): Promise<BrowserBookmarkNode[]>;
  create(input: {
    parentId: string | null;
    title: string;
    url: string | null;
  }): Promise<void>;
  update(id: string, patch: { title?: string; url?: string }): Promise<void>;
  move(id: string, parentId: string): Promise<void>;
  remove(id: string): Promise<void>;
  request(): Promise<
    "granted" | "denied" | "dismissed" | "failed" | "unsupported"
  >;
  revoke(): Promise<"revoked" | "failed" | "unsupported">;
}

function stamp(revision = 1) {
  const now = new Date().toISOString();
  return { revision, createdAt: now, updatedAt: now };
}
function bump<T extends { revision: number; updatedAt: string }>(
  row: T,
  patch: Partial<T>,
): T {
  return {
    ...row,
    ...patch,
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createProductivity(
  database: ProductivityDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
  updateHabitWithCalendar?: (
    id: string,
    expected: number,
    patch: Partial<Pick<HabitRecord, "title" | "frequency" | "reminder">>,
  ) => Promise<HabitRecord>,
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function load(): Promise<Library> {
    const [notes, folders, tasks, bookmarks, snapshots, habits] =
      await Promise.all([
        database.notes.toArray(),
        database.folders.toArray(),
        database.tasks.toArray(),
        database.localBookmarks.toArray(),
        database.bookmarkSnapshots.toArray(),
        database.habits.toArray(),
      ]);
    return { notes, folders, tasks, bookmarks, snapshots, habits };
  }
  async function createHabit(
    title: string,
    frequency: HabitRecord["frequency"],
  ) {
    const row = habitSchema.parse({
      id: crypto.randomUUID(),
      title: title.trim(),
      frequency,
      reminder: null,
      checkIns: [],
      ...stamp(),
    });
    await database.habits.put(row);
    changed(row.id, row.revision);
    return row;
  }
  async function updateHabit(
    id: string,
    expected: number,
    patch: Partial<Pick<HabitRecord, "title" | "frequency" | "reminder">>,
  ) {
    // Schedule-affecting updates must use Calendar's transaction so frequency
    // changes cancel invalid future occurrences as well as reminder edits.
    if (
      updateHabitWithCalendar &&
      (patch.reminder !== undefined || patch.frequency !== undefined)
    ) {
      const row = await updateHabitWithCalendar(id, expected, patch);
      changed(row.id, row.revision);
      return row;
    }
    if (patch.reminder !== undefined) throw new WorkspaceError("invalidInput");
    const row = await database.transaction(
      "rw",
      [database.habits],
      async () => {
        const current = await database.habits.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = habitSchema.parse(
          bump(current, {
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            frequency: patch.frequency ?? current.frequency,
            reminder:
              patch.reminder === undefined ? current.reminder : patch.reminder,
          }),
        );
        await database.habits.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function deleteHabit(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.habits],
      async () => {
        const current = await database.habits.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        await database.habits.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function toggleHabit(id: string, expected: number, date: string) {
    const row = await database.transaction(
      "rw",
      [database.habits],
      async () => {
        const current = await database.habits.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const has = current.checkIns.includes(date);
        const next = {
          ...bump(current, {
            checkIns: has
              ? current.checkIns.filter((item) => item !== date)
              : [...current.checkIns, date].sort(),
          }),
        };
        await database.habits.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function createFolder(
    scope: FolderRecord["scope"],
    name: string,
    parentId: string | null,
  ) {
    const row = await database.transaction(
      "rw",
      [database.folders],
      async () => {
        const folders = await database.folders.toArray();
        if (
          parentId &&
          folderCycle(folders, "00000000-0000-4000-8000-000000000000", parentId)
        )
          throw new WorkspaceError("invalidInput");
        if (parentId) {
          const parent = folders.find((folder) => folder.id === parentId);
          if (!parent || parent.scope !== scope)
            throw new WorkspaceError("invalidInput");
        }
        const siblings = folders.filter(
          (folder) => folder.scope === scope && folder.parentId === parentId,
        );
        const row = folderSchema.parse({
          id: crypto.randomUUID(),
          scope,
          parentId,
          name: name.trim(),
          sortIndex: siblings.length,
          ...stamp(),
        });
        if (folderCycle(folders, row.id, row.parentId))
          throw new WorkspaceError("invalidInput");
        await database.folders.put(row);
        return row;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function updateFolder(
    id: string,
    expected: number,
    patch: { name?: string; parentId?: string | null; sortIndex?: number },
  ) {
    const result = await database.transaction(
      "rw",
      [database.folders],
      async () => {
        const folders = await database.folders.toArray();
        const current = folders.find((folder) => folder.id === id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const parentId =
          patch.parentId === undefined ? current.parentId : patch.parentId;
        if (folderCycle(folders, id, parentId))
          throw new WorkspaceError("invalidInput");
        if (parentId) {
          const parent = folders.find((folder) => folder.id === parentId);
          if (!parent || parent.scope !== current.scope)
            throw new WorkspaceError("invalidInput");
        }
        const row = folderSchema.parse(
          bump(current, {
            name: patch.name === undefined ? current.name : patch.name.trim(),
            parentId,
            sortIndex: patch.sortIndex ?? current.sortIndex,
          }),
        );
        await database.folders.put(row);
        return row;
      },
    );
    changed(result.id, result.revision);
    return result;
  }
  async function deleteFolder(id: string, mode: "move" | "deleteContents") {
    const current = await database.transaction(
      "rw",
      [
        database.folders,
        database.notes,
        database.noteDrafts,
        database.localBookmarks,
      ],
      async () => {
        const folders = await database.folders.toArray();
        const current = folders.find((folder) => folder.id === id);
        if (!current) throw new WorkspaceError("notFound");
        const ids = descendantIds(folders, id);
        await database.transaction(
          "rw",
          [
            database.folders,
            database.notes,
            database.noteDrafts,
            database.localBookmarks,
          ],
          async () => {
            if (mode === "move") {
              for (const folder of folders) {
                if (folder.parentId === id) {
                  await database.folders.put(
                    bump(folder, { parentId: current.parentId }),
                  );
                }
              }
              if (current.scope === "notes") {
                for (const note of await database.notes.toArray()) {
                  if (note.folderId === id)
                    await database.notes.put(
                      bump(note, { folderId: current.parentId }),
                    );
                }
              } else {
                for (const bookmark of await database.localBookmarks.toArray()) {
                  if (bookmark.folderId === id)
                    await database.localBookmarks.put(
                      bump(bookmark, { folderId: current.parentId }),
                    );
                }
              }
              await database.folders.delete(id);
            } else {
              if (current.scope === "notes") {
                for (const note of await database.notes.toArray()) {
                  if (note.folderId && ids.includes(note.folderId)) {
                    for (const draft of await noteDrafts(note.id))
                      await database.noteDrafts.delete(draft.id);
                    await database.notes.delete(note.id);
                  }
                }
              } else {
                for (const bookmark of await database.localBookmarks.toArray()) {
                  if (bookmark.folderId && ids.includes(bookmark.folderId))
                    await database.localBookmarks.delete(bookmark.id);
                }
              }
              for (const folderId of ids)
                await database.folders.delete(folderId);
            }
          },
        );
        return current;
      },
    );
    changed(id, current.revision + 1);
  }
  async function validateFolder(
    id: string | null,
    scope: FolderRecord["scope"],
  ) {
    if (!id) return;
    const folder = await database.folders.get(id);
    if (!folder || folder.scope !== scope)
      throw new WorkspaceError("invalidInput");
  }
  async function createNote(input: {
    id?: string;
    title: string;
    body: NoteDocument;
    folderId: string | null;
    tags?: string[];
  }) {
    const row = await database.transaction(
      "rw",
      [database.notes, database.folders],
      async () => {
        if (input.id) {
          const existing = await database.notes.get(input.id);
          if (existing) return existing;
        }
        const row = noteSchema.parse({
          id: input.id ?? crypto.randomUUID(),
          title: input.title.trim(),
          body: validateNoteDocument(input.body),
          folderId: input.folderId,
          tags: normalizeTags(input.tags ?? []),
          sortIndex: -Date.now(),
          pinned: false,
          archived: false,
          trashedAt: null,
          ...stamp(),
        });
        await validateFolder(row.folderId, "notes");
        await writeNote(row);
        return row;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function saveNote(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        NoteRecord,
        | "sortIndex"
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
    const result = await database.transaction(
      "rw",
      [database.notes, database.folders],
      async () => {
        const current = await database.notes.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const row = noteSchema.parse(
          bump(current, {
            ...patch,
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            body: patch.body ? validateNoteDocument(patch.body) : current.body,
            tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
          }),
        );
        await validateFolder(row.folderId, "notes");
        await writeNote(row);
        return row;
      },
    );
    changed(result.id, result.revision);
    return result;
  }
  async function writeNote(row: NoteRecord) {
    try {
      await database.notes.put(row);
    } catch (error) {
      if (error instanceof WorkspaceError) throw error;
      throw new WorkspaceError("storageError");
    }
  }
  async function purgeNote(id: string) {
    await database.transaction(
      "rw",
      [database.notes, database.noteDrafts],
      async () => {
        const current = await database.notes.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (!current.trashedAt) throw new WorkspaceError("invalidInput");
        for (const draft of await noteDrafts(id))
          await database.noteDrafts.delete(draft.id);
        await database.notes.delete(id);
      },
    );
    changed(id, Date.now());
  }
  async function createTask(
    title: string,
    details = "",
    today = false,
    id?: string,
  ) {
    const row = await database.transaction("rw", [database.tasks], async () => {
      if (id) {
        const existing = await database.tasks.get(id);
        if (existing) return existing;
      }
      const next = taskSchema.parse({
        id: id ?? crypto.randomUUID(),
        title: title.trim(),
        details,
        status: "open",
        column: "todo",
        sortIndex: Date.now(),
        today,
        todayOrder: Date.now(),
        labels: [],
        checklist: [],
        priority: 2,
        dueDate: null,
        eventId: null,
        focusRank: null,
        completedAt: null,
        ...stamp(),
      });
      await database.tasks.put(next);
      return next;
    });
    changed(row.id, row.revision);
    return row;
  }
  async function saveTask(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        TaskRecord,
        | "title"
        | "details"
        | "status"
        | "priority"
        | "dueDate"
        | "eventId"
        | "focusRank"
        | "column"
        | "sortIndex"
        | "today"
        | "todayOrder"
        | "labels"
        | "checklist"
      >
    >,
  ) {
    const result = await database.transaction(
      "rw",
      [database.tasks],
      async () => {
        const current = await database.tasks.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const focusRank =
          patch.focusRank === undefined ? current.focusRank : patch.focusRank;
        const status = patch.column
          ? patch.column === "done"
            ? "done"
            : "open"
          : (patch.status ?? current.status);
        if (focusRank !== null && status === "open") {
          const tasks = await database.tasks.toArray();
          const taken = tasks.some(
            (task) =>
              task.id !== id &&
              task.status === "open" &&
              task.focusRank === focusRank,
          );
          if (taken) throw new WorkspaceError("invalidInput");
        }
        const row = taskSchema.parse(
          bump(current, {
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            details: patch.details ?? current.details,
            column:
              status === "done"
                ? "done"
                : (patch.column ??
                  (taskColumn(current) === "done"
                    ? "todo"
                    : taskColumn(current))),
            sortIndex: patch.sortIndex ?? current.sortIndex ?? 0,
            today: patch.today ?? current.today ?? false,
            todayOrder: patch.todayOrder ?? current.todayOrder ?? 0,
            labels: normalizeTags(patch.labels ?? current.labels ?? []),
            checklist: patch.checklist ?? current.checklist ?? [],
            status,
            priority: patch.priority ?? current.priority,
            dueDate:
              patch.dueDate === undefined
                ? current.dueDate
                : validDueDate(patch.dueDate),
            eventId:
              patch.eventId === undefined
                ? current.eventId
                : optionalEventId(patch.eventId),
            focusRank: status === "done" ? null : focusRank,
            completedAt:
              status === "done"
                ? (current.completedAt ?? new Date().toISOString())
                : null,
          }),
        );
        await database.tasks.put(row);
        return row;
      },
    );
    changed(result.id, result.revision);
    return result;
  }
  async function deleteTask(id: string, expected: number) {
    await database.transaction("rw", [database.tasks], async () => {
      const current = await database.tasks.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expected) throw new WorkspaceError("conflict");
      await database.tasks.delete(id);
    });
    changed(id, expected + 1);
  }
  async function moveTask(
    id: string,
    expected: number,
    column: TaskColumn,
    index: number,
  ) {
    await database.transaction("rw", [database.tasks], async () => {
      const tasks = await database.tasks.toArray();
      const current = tasks.find((task) => task.id === id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expected) throw new WorkspaceError("conflict");
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        !["todo", "doing", "done"].includes(column)
      )
        throw new WorkspaceError("invalidInput");
      const rows = sortedTasks(
        tasks.filter((task) => task.id !== id && taskColumn(task) === column),
      );
      rows.splice(Math.min(index, rows.length), 0, current);
      for (const [sortIndex, task] of rows.entries()) {
        await database.tasks.put(
          taskSchema.parse(
            bump(task, {
              sortIndex,
              column,
              status: column === "done" ? "done" : "open",
              completedAt:
                column === "done"
                  ? (task.completedAt ?? new Date().toISOString())
                  : null,
              focusRank: column === "done" ? null : task.focusRank,
            }),
          ),
        );
      }
    });
    changed(id, expected + 1);
  }
  async function reorderToday(rows: { id: string; revision: number }[]) {
    await database.transaction("rw", [database.tasks], async () => {
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        throw new WorkspaceError("invalidInput");
      for (const [todayOrder, input] of rows.entries()) {
        const task = await database.tasks.get(input.id);
        if (!task || !task.today || task.revision !== input.revision)
          throw new WorkspaceError("conflict");
        await database.tasks.put(bump(task, { todayOrder }));
      }
    });
    changed("today-order", Date.now());
  }
  async function reorderNotes(rows: { id: string; revision: number }[]) {
    await database.transaction("rw", [database.notes], async () => {
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        throw new WorkspaceError("invalidInput");
      for (const [sortIndex, input] of rows.entries()) {
        const note = await database.notes.get(input.id);
        if (!note || note.revision !== input.revision)
          throw new WorkspaceError("conflict");
        await database.notes.put(bump(note, { sortIndex }));
      }
    });
    changed("note-order", Date.now());
  }
  async function createBookmark(input: {
    title: string;
    url: string;
    folderId: string | null;
    quick?: boolean;
    iconLabel?: string | null;
  }) {
    const row = await database.transaction(
      "rw",
      [database.localBookmarks, database.folders],
      async () => {
        const bookmarks = await database.localBookmarks.toArray();
        const row = localBookmarkSchema.parse({
          id: crypto.randomUUID(),
          title: input.title.trim(),
          url: canonicalHttpUrl(input.url),
          folderId: input.folderId,
          iconLabel: input.iconLabel ?? null,
          sortOrder: bookmarks.length,
          quick: input.quick ?? false,
          ...stamp(),
        });
        await validateFolder(row.folderId, "localBookmarks");
        await database.localBookmarks.put(row);
        return row;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function saveBookmark(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        LocalBookmarkRecord,
        "title" | "url" | "folderId" | "quick" | "iconLabel" | "sortOrder"
      >
    >,
  ) {
    const result = await database.transaction(
      "rw",
      [database.localBookmarks, database.folders],
      async () => {
        const current = await database.localBookmarks.get(id);
        if (!current) throw new WorkspaceError("notFound");
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const row = localBookmarkSchema.parse(
          bump(current, {
            ...patch,
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            url:
              patch.url === undefined
                ? current.url
                : canonicalHttpUrl(patch.url),
          }),
        );
        await validateFolder(row.folderId, "localBookmarks");
        await database.localBookmarks.put(row);
        return row;
      },
    );
    changed(result.id, result.revision);
    return result;
  }
  async function deleteBookmark(id: string, expected?: number) {
    await database.transaction("rw", [database.localBookmarks], async () => {
      const current = await database.localBookmarks.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (expected !== undefined && current.revision !== expected)
        throw new WorkspaceError("conflict");
      await database.localBookmarks.delete(id);
    });
    changed(id, Date.now());
  }
  async function reorderBookmarks(rows: { id: string; revision: number }[]) {
    await database.transaction("rw", [database.localBookmarks], async () => {
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        throw new WorkspaceError("invalidInput");
      for (const [sortOrder, input] of rows.entries()) {
        const row = await database.localBookmarks.get(input.id);
        if (!row || row.revision !== input.revision)
          throw new WorkspaceError("conflict");
        await database.localBookmarks.put(bump(row, { sortOrder }));
      }
    });
    changed("bookmark-order", Date.now());
  }
  async function replaceSnapshots(rows: BookmarkSnapshotRecord[]) {
    const parsed = rows.map((row) => bookmarkSnapshotSchema.parse(row));
    await database.transaction("rw", [database.bookmarkSnapshots], async () => {
      await database.bookmarkSnapshots.clear();
      for (const row of parsed) await database.bookmarkSnapshots.put(row);
    });
    changed("snapshots", parsed.length);
    return parsed;
  }
  async function readBrowser(port: BrowserBookmarkPort) {
    const access = await port.permission();
    if (access !== "granted")
      return { access, tree: [] as BrowserBookmarkNode[] };
    return { access, tree: await port.tree() };
  }
  async function changeBrowser(
    port: BrowserBookmarkPort,
    confirmed: boolean,
    work: () => Promise<void>,
  ) {
    if (!confirmed) throw new WorkspaceError("invalidInput");
    const access = await port.permission();
    if (access !== "granted") return access;
    await work();
    return "granted" as const;
  }
  async function requestBrowser(port: BrowserBookmarkPort) {
    return port.request();
  }
  async function revokeBrowser(port: BrowserBookmarkPort) {
    return port.revoke();
  }
  async function saveNoteDraft(draft: NoteDraft) {
    const checked = noteSchema.parse({
      id: draft.noteId,
      title: draft.title,
      body: validateNoteDocument(draft.body),
      tags: normalizeTags(draft.tags),
      folderId: null,
      pinned: false,
      archived: false,
      trashedAt: null,
      revision: draft.expectedRevision,
      createdAt: draft.updatedAt,
      updatedAt: draft.updatedAt,
    });
    if (!draft.id || draft.id.length > 200)
      throw new WorkspaceError("invalidInput");
    await database.noteDrafts.put({
      ...draft,
      title: checked.title,
      body: checked.body,
      tags: checked.tags,
    });
  }
  async function noteDrafts(noteId: string) {
    return (await database.noteDrafts.toArray())
      .filter((draft) => draft.noteId === noteId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async function removeNoteDraft(id: string) {
    await database.noteDrafts.delete(id);
  }
  return {
    load,
    createFolder,
    createHabit,
    toggleHabit,
    updateHabit,
    deleteHabit,
    updateFolder,
    deleteFolder,
    createNote,
    saveNoteDraft,
    noteDrafts,
    removeNoteDraft,
    saveNote,
    purgeNote,
    createTask,
    saveTask,
    deleteTask,
    moveTask,
    reorderToday,
    reorderNotes,
    createBookmark,
    saveBookmark,
    deleteBookmark,
    reorderBookmarks,
    replaceSnapshots,
    readBrowser,
    changeBrowser,
    requestBrowser,
    revokeBrowser,
  };
}

export type Productivity = ReturnType<typeof createProductivity>;
