import { beforeEach, describe, expect, it } from "vitest";
import { createProductivity } from "../../src/application/productivity";
import { emptyDocument } from "../../src/domain/productivity";
import { db, productivityDb } from "../../src/infrastructure/db";

beforeEach(async () => {
  await db.notes.clear();
  await db.folders.clear();
  await db.tasks.clear();
  await db.localBookmarks.clear();
  await db.bookmarkSnapshots.clear();
});

describe("P02 IndexedDB productivity", () => {
  it("reloads a note and moves folder contents without deleting the note", async () => {
    const productivity = createProductivity(productivityDb);
    const parent = await productivity.createFolder("notes", "Parent", null);
    const child = await productivity.createFolder("notes", "Child", parent.id);
    const note = await productivity.createNote({
      title: "Kept",
      body: emptyDocument("body"),
      folderId: child.id,
    });
    await productivity.deleteFolder(child.id, "move");
    const library = await productivity.load();
    expect(library.folders.some((folder) => folder.id === child.id)).toBe(
      false,
    );
    expect(library.notes.find((item) => item.id === note.id)?.folderId).toBe(
      parent.id,
    );
    expect((await db.notes.get(note.id))?.title).toBe("Kept");
  });
});
