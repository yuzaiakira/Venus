import type { WorkspaceChange } from "./workspace";
import { WorkspaceError } from "../domain/dashboard";
import {
  bookmarkSnapshotSchema,
  canonicalHttpUrl,
  descendantIds,
  folderCycle,
  folderSchema,
  localBookmarkSchema,
  normalizeTags,
  noteSchema,
  optionalEventId,
  taskSchema,
  validDueDate,
  validateNoteDocument,
  type BookmarkSnapshotRecord,
  type BrowserBookmarkNode,
  type FolderRecord,
  type LocalBookmarkRecord,
  type NoteDocument,
  type NoteRecord,
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
  folders: RowTable<FolderRecord>;
  tasks: RowTable<TaskRecord>;
  localBookmarks: RowTable<LocalBookmarkRecord>;
  bookmarkSnapshots: RowTable<BookmarkSnapshotRecord>;
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
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function load(): Promise<Library> {
    const [notes, folders, tasks, bookmarks, snapshots] = await Promise.all([
      database.notes.toArray(),
      database.folders.toArray(),
      database.tasks.toArray(),
      database.localBookmarks.toArray(),
      database.bookmarkSnapshots.toArray(),
    ]);
    return { notes, folders, tasks, bookmarks, snapshots };
  }
  async function createFolder(
    scope: FolderRecord["scope"],
    name: string,
    parentId: string | null,
  ) {
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
    changed(row.id, row.revision);
    return row;
  }
  async function updateFolder(
    id: string,
    expected: number,
    patch: { name?: string; parentId?: string | null; sortIndex?: number },
  ) {
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
    changed(row.id, row.revision);
    return row;
  }
  async function deleteFolder(id: string, mode: "move" | "deleteContents") {
    const folders = await database.folders.toArray();
    const current = folders.find((folder) => folder.id === id);
    if (!current) throw new WorkspaceError("notFound");
    const ids = descendantIds(folders, id);
    await database.transaction(
      "rw",
      [database.folders, database.notes, database.localBookmarks],
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
              if (note.folderId && ids.includes(note.folderId))
                await database.notes.delete(note.id);
            }
          } else {
            for (const bookmark of await database.localBookmarks.toArray()) {
              if (bookmark.folderId && ids.includes(bookmark.folderId))
                await database.localBookmarks.delete(bookmark.id);
            }
          }
          for (const folderId of ids) await database.folders.delete(folderId);
        }
      },
    );
    changed(id, current.revision + 1);
  }
  async function createNote(input: {
    title: string;
    body: NoteDocument;
    folderId: string | null;
    tags?: string[];
  }) {
    const row = noteSchema.parse({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      body: validateNoteDocument(input.body),
      folderId: input.folderId,
      tags: normalizeTags(input.tags ?? []),
      pinned: false,
      archived: false,
      trashedAt: null,
      ...stamp(),
    });
    await writeNote(row);
    changed(row.id, row.revision);
    return row;
  }
  async function saveNote(
    id: string,
    expected: number,
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
    const current = await database.notes.get(id);
    if (!current) throw new WorkspaceError("notFound");
    if (current.revision !== expected) throw new WorkspaceError("conflict");
    const row = noteSchema.parse(
      bump(current, {
        ...patch,
        title: patch.title === undefined ? current.title : patch.title.trim(),
        body: patch.body ? validateNoteDocument(patch.body) : current.body,
        tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
      }),
    );
    await writeNote(row);
    changed(row.id, row.revision);
    return row;
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
    const current = await database.notes.get(id);
    if (!current) throw new WorkspaceError("notFound");
    await database.notes.delete(id);
    changed(id, current.revision + 1);
  }
  async function createTask(title: string) {
    const row = taskSchema.parse({
      id: crypto.randomUUID(),
      title: title.trim(),
      details: "",
      status: "open",
      priority: 2,
      dueDate: null,
      eventId: null,
      focusRank: null,
      completedAt: null,
      ...stamp(),
    });
    await database.tasks.put(row);
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
      >
    >,
  ) {
    const current = await database.tasks.get(id);
    if (!current) throw new WorkspaceError("notFound");
    if (current.revision !== expected) throw new WorkspaceError("conflict");
    const focusRank =
      patch.focusRank === undefined ? current.focusRank : patch.focusRank;
    if (focusRank !== null) {
      const tasks = await database.tasks.toArray();
      const taken = tasks.some(
        (task) =>
          task.id !== id &&
          task.status === "open" &&
          task.focusRank === focusRank,
      );
      if (taken) throw new WorkspaceError("invalidInput");
    }
    const status = patch.status ?? current.status;
    const row = taskSchema.parse(
      bump(current, {
        title: patch.title === undefined ? current.title : patch.title.trim(),
        details: patch.details ?? current.details,
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
    changed(row.id, row.revision);
    return row;
  }
  async function createBookmark(input: {
    title: string;
    url: string;
    folderId: string | null;
    quick?: boolean;
    iconLabel?: string | null;
  }) {
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
    await database.localBookmarks.put(row);
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
    const current = await database.localBookmarks.get(id);
    if (!current) throw new WorkspaceError("notFound");
    if (current.revision !== expected) throw new WorkspaceError("conflict");
    const row = localBookmarkSchema.parse(
      bump(current, {
        ...patch,
        title: patch.title === undefined ? current.title : patch.title.trim(),
        url:
          patch.url === undefined ? current.url : canonicalHttpUrl(patch.url),
      }),
    );
    await database.localBookmarks.put(row);
    changed(row.id, row.revision);
    return row;
  }
  async function deleteBookmark(id: string) {
    const current = await database.localBookmarks.get(id);
    if (!current) throw new WorkspaceError("notFound");
    await database.localBookmarks.delete(id);
    changed(id, current.revision + 1);
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
  return {
    load,
    createFolder,
    updateFolder,
    deleteFolder,
    createNote,
    saveNote,
    purgeNote,
    createTask,
    saveTask,
    createBookmark,
    saveBookmark,
    deleteBookmark,
    replaceSnapshots,
    readBrowser,
    changeBrowser,
    requestBrowser,
    revokeBrowser,
  };
}

export type Productivity = ReturnType<typeof createProductivity>;
