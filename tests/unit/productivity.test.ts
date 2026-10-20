import { describe, expect, it } from "vitest";
import {
  applyBlockLink,
  canonicalHttpUrl,
  documentFromPlainText,
  emptyDocument,
  folderCycle,
  folderDepth,
  noteDocumentSchema,
  pastedPlainText,
  previewNotes,
  previewQuickLinks,
  previewTodayTasks,
  safeLink,
  searchLibrary,
  snapshotFromTree,
  type BookmarkSnapshotRecord,
  type FolderRecord,
  type LocalBookmarkRecord,
  type NoteRecord,
  type NoteDraft,
  type TaskRecord,
} from "../../src/domain/productivity";
import {
  createProductivity,
  type ProductivityDatabase,
  type RowTable,
} from "../../src/application/productivity";
import { WorkspaceError } from "../../src/domain/dashboard";

function table<T extends { id: string }>() {
  const rows = new Map<string, T>();
  const store: RowTable<T> & { fail: boolean } = {
    fail: false,
    async get(id) {
      return rows.get(id);
    },
    async put(row) {
      if (store.fail) throw new Error("quota");
      rows.set(row.id, row);
    },
    async delete(id) {
      rows.delete(id);
    },
    async toArray() {
      return [...rows.values()];
    },
    async clear() {
      rows.clear();
    },
  };
  return store;
}

function database(): ProductivityDatabase {
  const notes = table<NoteRecord>();
  const folders = table<FolderRecord>();
  const tasks = table<TaskRecord>();
  const localBookmarks = table<LocalBookmarkRecord>();
  const bookmarkSnapshots = table<BookmarkSnapshotRecord>();
  return {
    notes,
    noteDrafts: table<NoteDraft>(),
    folders,
    tasks,
    localBookmarks,
    bookmarkSnapshots,
    habits: table(),
    async transaction(_mode, _tables, work) {
      return work();
    },
  };
}

describe("P02 productivity domain", () => {
  it("stores pasted markup as text and rejects unsafe links", () => {
    const text = pastedPlainText(
      '<img src="x" onerror="globalThis.pwned=1"><script>alert(1)</script>hello',
    );
    expect(text).toBe("alert(1)hello");
    const document = documentFromPlainText(text);
    expect(JSON.stringify(document)).not.toContain("onerror");
    expect(noteDocumentSchema.parse(document).type).toBe("doc");
    expect(() => safeLink("javascript:alert(1)")).toThrow(WorkspaceError);
    const block = emptyDocument("Orbit").content[0];
    if (!block) throw new Error("missing block");
    const linked = applyBlockLink(block, "https://example.com/a");
    expect(JSON.stringify(linked)).toContain("https://example.com/a");
    expect(() => applyBlockLink(block, "javascript:alert(1)")).toThrow(
      WorkspaceError,
    );
    expect(() => applyBlockLink(block, "data:text/html,hi")).toThrow(
      WorkspaceError,
    );
    expect(() => applyBlockLink(block, "file:///tmp/x")).toThrow(
      WorkspaceError,
    );
    const cleared = applyBlockLink(linked, null);
    expect(JSON.stringify(cleared)).not.toContain("link");
    expect(safeLink("https://example.com/a")).toBe("https://example.com/a");
    expect(() => canonicalHttpUrl("javascript:alert(1)")).toThrow(
      WorkspaceError,
    );
  });
  it("rejects folder cycles and keeps a nested chain", () => {
    const folders = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(folderCycle(folders, "a", "c")).toBe(true);
    expect(folderCycle(folders, "c", null)).toBe(false);
    expect(folderDepth(folders, "c")).toBe(3);
  });
  it("searches ten thousand local rows without dropping Persian variants", () => {
    const notes = Array.from({ length: 10_000 }, (_, index) => ({
      id: crypto.randomUUID(),
      title: index === 9999 ? "يادداشت ك" : `note ${index}`,
      body: emptyDocument(index === 9999 ? "متن" : "body"),
      folderId: null,
      tags: [],
      pinned: false,
      archived: false,
      trashedAt: null,
      revision: 1,
      createdAt: "2026-10-10T00:00:00.000Z",
      updatedAt: "2026-10-10T00:00:00.000Z",
    }));
    const started = performance.now();
    const hits = searchLibrary(
      { notes, tasks: [], bookmarks: [], commands: [] },
      "یادداشت ک",
    );
    expect(performance.now() - started).toBeLessThan(500);
    expect(hits).toHaveLength(1);
  });
  it("exports browser bookmarks without their browser ids", () => {
    const rows = snapshotFromTree(
      [
        {
          id: "browser-root",
          title: "Bar",
          children: [
            {
              id: "browser-secret",
              title: "Example",
              url: "https://example.com",
            },
            { id: "bad", title: "Script", url: "javascript:alert(1)" },
          ],
        },
      ],
      "browser",
      "2026-10-10T00:00:00.000Z",
      () => crypto.randomUUID(),
    );
    expect(JSON.stringify(rows)).not.toContain("browser-secret");
    expect(rows.map((row) => row.title)).toEqual(["Bar", "Example"]);
    expect(rows[1]?.portablePath).toBe("Bar/Example");
  });
});

describe("P02 productivity records", () => {
  it("conflicts instead of overwriting and preserves a draft when storage fails", async () => {
    const notes = table<NoteRecord>();
    const store = database();
    store.notes = notes;
    const productivity = createProductivity(store);
    const note = await productivity.createNote({
      title: "One",
      body: emptyDocument("alpha"),
      folderId: null,
    });
    const saved = await productivity.saveNote(note.id, note.revision, {
      title: "Two",
    });
    await expect(
      productivity.saveNote(note.id, note.revision, { title: "Stale" }),
    ).rejects.toThrow("conflict");
    expect((await store.notes.get(note.id))?.title).toBe("Two");
    notes.fail = true;
    await expect(
      productivity.saveNote(note.id, saved.revision, { title: "Three" }),
    ).rejects.toThrow("storageError");
    expect((await store.notes.get(note.id))?.title).toBe("Two");
  });
  it("nests folders, rejects a cycle, and completes three focus tasks", async () => {
    const productivity = createProductivity(database());
    let parent: string | null = null;
    for (let index = 0; index < 8; index += 1) {
      const folder = await productivity.createFolder(
        "notes",
        `L${index}`,
        parent,
      );
      parent = folder.id;
    }
    const library = await productivity.load();
    const deepest = library.folders.find((folder) => folder.name === "L7");
    expect(deepest).toBeTruthy();
    if (!deepest) return;
    expect(folderDepth(library.folders, deepest.id)).toBe(8);
    const root = library.folders.find((folder) => folder.name === "L0");
    if (!root) return;
    await expect(
      productivity.updateFolder(root.id, root.revision, {
        parentId: deepest.id,
      }),
    ).rejects.toThrow("invalidInput");
    const tasks = [];
    for (const title of ["A", "B", "C"]) {
      const task = await productivity.createTask(title);
      tasks.push(
        await productivity.saveTask(task.id, task.revision, {
          focusRank: (tasks.length + 1) as 1 | 2 | 3,
        }),
      );
    }
    const extra = await productivity.createTask("D");
    await expect(
      productivity.saveTask(extra.id, extra.revision, { focusRank: 1 }),
    ).rejects.toThrow("invalidInput");
    const first = tasks[0];
    const second = tasks[1];
    if (!first || !second) return;
    const done = await productivity.saveTask(first.id, first.revision, {
      status: "done",
    });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeTruthy();
    expect(done.focusRank).toBeNull();
    const linked = await productivity.saveTask(second.id, second.revision, {
      eventId: "not-a-uuid",
    });
    expect(linked.eventId).toBeNull();
  });
  it("keeps local bookmarks available when browser permission is missing", async () => {
    const productivity = createProductivity(database());
    const bookmark = await productivity.createBookmark({
      title: "Local",
      url: "https://example.com",
      folderId: null,
      quick: true,
    });
    expect(bookmark.quick).toBe(true);
    await expect(
      productivity.createBookmark({
        title: "Bad",
        url: "javascript:alert(1)",
        folderId: null,
      }),
    ).rejects.toThrow("invalidInput");
    let created = 0;
    const port = {
      async permission() {
        return "missing" as const;
      },
      async tree() {
        return [];
      },
      async create(input: {
        parentId: string | null;
        title: string;
        url: string | null;
      }) {
        void input;
        created += 1;
      },
      async update() {},
      async move() {},
      async remove() {},
      async request() {
        return "denied" as const;
      },
      async revoke() {
        return "revoked" as const;
      },
    };
    const view = await productivity.readBrowser(port);
    expect(view.access).toBe("missing");
    expect(view.tree).toEqual([]);
    const change = await productivity.changeBrowser(port, true, () =>
      port.create({ parentId: null, title: "X", url: null }),
    );
    expect(change).toBe("missing");
    expect(created).toBe(0);
    expect(await productivity.requestBrowser(port)).toBe("denied");
  });

  it("previews today tasks, notes, and quick links for dashboard widgets", () => {
    const stamp = "2026-10-15T12:00:00.000Z";
    const open: TaskRecord = {
      id: "t1",
      title: "Open work",
      details: "",
      status: "open",
      priority: 2,
      dueDate: null,
      eventId: null,
      focusRank: null,
      completedAt: null,
      revision: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const focus: TaskRecord = {
      ...open,
      id: "t2",
      title: "Focus",
      focusRank: 1,
      priority: 3,
    };
    expect(previewTodayTasks([open, focus]).map((task) => task.id)).toEqual([
      "t2",
    ]);
    expect(previewTodayTasks([open]).map((task) => task.id)).toEqual(["t1"]);

    const notes: NoteRecord[] = [
      {
        id: "n1",
        title: "Older",
        body: emptyDocument("a"),
        folderId: null,
        tags: [],
        pinned: false,
        archived: false,
        trashedAt: null,
        revision: 1,
        createdAt: stamp,
        updatedAt: "2026-10-14T12:00:00.000Z",
      },
      {
        id: "n2",
        title: "Pinned",
        body: emptyDocument("b"),
        folderId: null,
        tags: [],
        pinned: true,
        archived: false,
        trashedAt: null,
        revision: 1,
        createdAt: stamp,
        updatedAt: "2026-10-13T12:00:00.000Z",
      },
    ];
    expect(previewNotes(notes).map((note) => note.id)).toEqual(["n2", "n1"]);

    const bookmarks: LocalBookmarkRecord[] = [
      {
        id: "b1",
        title: "GitHub",
        url: "https://github.com/",
        folderId: null,
        sortOrder: 0,
        quick: false,
        iconLabel: null,
        revision: 1,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "b2",
        title: "Docs",
        url: "https://example.com/",
        folderId: null,
        sortOrder: 0,
        quick: true,
        iconLabel: null,
        revision: 1,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ];
    expect(previewQuickLinks(bookmarks).map((row) => row.id)).toEqual(["b2"]);
    expect(
      previewQuickLinks(bookmarks.map((row) => ({ ...row, quick: false }))).map(
        (row) => row.id,
      ),
    ).toContain("b1");
  });
});
