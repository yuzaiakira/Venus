/* global chrome, indexedDB, document, HTMLTextAreaElement, IDBObjectStore, window, Event, HTMLInputElement, DOMException, location */
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = "/usr/bin/chromium";
const extension = resolve(".output/chrome-mv3");
const evidenceDir = resolve("evidence/P02");
await mkdir(evidenceDir, { recursive: true });
const checks = [];
const record = (id, status, detail) => {
  checks.push({ id, status, detail });
  console.log(`${status} ${id}`);
};

async function launch(profile, extensionPath = extension) {
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  await context.setOffline(true);
  return context;
}
async function openNewTab(context) {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  return page;
}
async function skip(page) {
  const skipButton = page.getByRole("button", { name: "Skip setup" });
  await skipButton.waitFor({ timeout: 15000 });
  await skipButton.click();
  await page
    .getByRole("dialog", { name: "Welcome" })
    .waitFor({ state: "hidden" });
  await page.waitForFunction(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return stored["venus.bootstrap"]?.onboardingComplete === true;
  });
  await page.waitForFunction(() => document.documentElement.dir === "ltr");
}
async function rows(page, store) {
  return page.evaluate(async (storeName) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const version = db.version;
    const names = [...db.objectStoreNames];
    const values = names.includes(storeName)
      ? await new Promise((resolve, reject) => {
          const request = db
            .transaction(storeName)
            .objectStore(storeName)
            .getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        })
      : [];
    db.close();
    return { version, names, values };
  }, store);
}
async function notesOf(page) {
  return (await rows(page, "notes")).values;
}
async function waitNote(page, predicate) {
  const started = Date.now();
  while (Date.now() - started < 4000) {
    const values = await notesOf(page);
    const found = values.some((note) => {
      const text = JSON.stringify(note.body);
      if (predicate.title) return note.title === predicate.title;
      if (predicate.includes)
        return (
          text.includes(predicate.includes) ||
          note.title.includes(predicate.includes)
        );
      return false;
    });
    if (found) return;
    await page.waitForTimeout(100);
  }
}

const profile = await mkdtemp(join(tmpdir(), "venus-p02-"));
const context = await launch(profile);
let version = "";
try {
  version = await context.browser().version();
  const page = await openNewTab(context);
  await skip(page);
  const directionEn = await page.evaluate(() => document.documentElement.dir);
  record("en-ltr", directionEn === "ltr" ? "PASS" : "FAIL", {
    direction: directionEn,
  });

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("button", { name: "New note" }).click();
  const titleField = notes.getByLabel("Title");
  await titleField.waitFor();
  await titleField.fill("Orbit note");
  await page.waitForTimeout(1000);
  const saveStatus = await notes
    .locator("[data-save-status]")
    .getAttribute("data-save-status")
    .catch(() => "missing");
  const titleValue = await titleField.inputValue();
  const beforeReload = await notesOf(page);
  record("note-before-reload", "INFO", {
    saveStatus,
    titleValue,
    stored: beforeReload.map((note) => ({
      title: note.title,
      revision: note.revision,
    })),
  });
  if (!beforeReload.some((note) => note.title === "Orbit note"))
    throw new Error(
      `note was not stored: status=${saveStatus} value=${titleValue} stored=${beforeReload.map((note) => note.title).join(",")}`,
    );
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const notesRegion = page.getByRole("region", { name: "Notes" });
  try {
    await notesRegion.getByText("Orbit note").waitFor({ timeout: 5000 });
    record("note-persists", "PASS", "visible after reload");
  } catch (error) {
    record("note-persists", "FAIL", String(error).slice(0, 300));
  }

  await notesRegion.getByRole("button", { name: "Orbit note" }).click();
  const editor = notesRegion.locator("form");
  await editor.getByLabel("Title").fill("Orbit note");
  await editor.locator("textarea").fill("plain body");
  await editor.getByRole("button", { name: "Bold" }).click();
  await editor.getByLabel("Block").selectOption("heading");
  await editor.locator("textarea").fill("Heading text");
  await editor.getByRole("button", { name: "Italic" }).click();
  await editor.getByRole("button", { name: "Add block" }).click();
  await editor.getByLabel("Block").last().selectOption("taskList");
  await editor.locator("textarea").last().fill("Checklist item");
  await editor.getByLabel("Tags").fill("alpha, beta");
  await waitNote(page, { includes: "Checklist item" });
  const storedNotes = await notesOf(page);
  const rich = storedNotes.find((note) =>
    JSON.stringify(note.body).includes("Checklist item"),
  );
  const linkControl = await notesRegion
    .getByRole("button", { name: /link/i })
    .count();
  record(
    "rich-editor-controls",
    rich &&
      JSON.stringify(rich.body).includes("taskList") &&
      JSON.stringify(rich.body).includes("italic") &&
      rich.tags.includes("alpha") &&
      rich.tags.includes("beta")
      ? "PASS"
      : "FAIL",
    {
      tags: rich?.tags,
      types: rich?.body?.content?.map((block) => block.type),
      linkButtons: linkControl,
      body: JSON.stringify(storedNotes[0]?.body ?? null).slice(0, 500),
    },
  );
  await editor.getByLabel("Link address").first().fill("javascript:alert(1)");
  await editor
    .getByRole("button", { name: "Link", exact: true })
    .first()
    .click();
  const rejectedLink = await editor.locator(".error").first().innerText();
  await editor
    .getByLabel("Link address")
    .first()
    .fill("https://example.com/orbit");
  await editor
    .getByRole("button", { name: "Link", exact: true })
    .first()
    .click();
  await waitNote(page, { includes: "https://example.com/orbit" });
  const linked = (await notesOf(page)).find((note) =>
    JSON.stringify(note.body).includes("https://example.com/orbit"),
  );
  await editor.getByRole("button", { name: "Remove link" }).first().click();
  await page.waitForTimeout(600);
  const unlinked = (await notesOf(page)).find((note) => note.id === linked?.id);
  record(
    "link-control",
    rejectedLink.includes("was not saved") &&
      linked &&
      !JSON.stringify(unlinked?.body ?? {}).includes(
        "https://example.com/orbit",
      )
      ? "PASS"
      : "FAIL",
    {
      rejectedLink,
      storedHref: JSON.stringify(linked?.body ?? {}).includes(
        "https://example.com/orbit",
      ),
      removed: !JSON.stringify(unlinked?.body ?? {}).includes(
        "https://example.com/orbit",
      ),
    },
  );

  await editor
    .locator("textarea")
    .first()
    .evaluate((element) => {
      window.__venusXss = 0;
      const markup =
        '<img src="x" onerror="window.__venusXss=1"><script>window.__venusXss=1</script>Visible paste';
      const prototype = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      );
      prototype.set.call(element, markup);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  await waitNote(page, { includes: "Visible paste" });
  const pasted = (await notesOf(page)).find((note) =>
    JSON.stringify(note.body).includes("Visible paste"),
  );
  const xss = await page.evaluate(() => window.__venusXss);
  const scriptNodes = await notesRegion.locator("script").count();
  const storedMarkup = JSON.stringify(pasted?.body ?? {});
  record(
    "html-paste-as-text",
    xss === 0 &&
      scriptNodes === 0 &&
      storedMarkup.includes("Visible paste") &&
      storedMarkup.includes('"type":"text"')
      ? "PASS"
      : "FAIL",
    {
      xss,
      scriptNodes,
      literalMarkupRetained:
        storedMarkup.includes("<script") && storedMarkup.includes("onerror"),
      note: "The block editor stores pasted characters in a JSON text node. It does not parse them as HTML.",
    },
  );

  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const note = await new Promise((resolve, reject) => {
      const request = db.transaction("notes").objectStore("notes").getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve(
          request.result.find((row) =>
            JSON.stringify(row.body).includes("Visible paste"),
          ) ?? null,
        );
    });
    if (!note?.body?.content) {
      db.close();
      return "missing-note";
    }
    note.body.content.push({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "unsafe",
          marks: [{ type: "link", href: "javascript:alert(1)" }],
        },
      ],
    });
    note.body.content.push({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "safe",
          marks: [{ type: "link", href: "https://example.com/note" }],
        },
      ],
    });
    await new Promise((resolve, reject) => {
      const request = db
        .transaction("notes", "readwrite")
        .objectStore("notes")
        .put(note);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const reloadedNotes = page.getByRole("region", { name: "Notes" });
  await reloadedNotes.getByRole("button", { name: "Orbit note" }).click();
  const javascriptLinks = await reloadedNotes
    .locator('a[href^="javascript:"]')
    .count();
  const safeLink = await reloadedNotes
    .locator('a[href="https://example.com/note"]')
    .count();
  record(
    "unsafe-link-rejected",
    javascriptLinks === 0 && safeLink === 1 ? "PASS" : "FAIL",
    { javascriptLinks, safeLink },
  );

  const other = await openNewTab(context);
  await page.getByRole("button", { name: "New note" }).click();
  const sharedTitle = page
    .getByRole("region", { name: "Notes" })
    .getByLabel("Title");
  await page.waitForFunction(() => {
    const input = document.querySelector("form input.field");
    return input instanceof HTMLInputElement && input.value === "Untitled note";
  });
  await sharedTitle.fill("Shared note");
  await waitNote(page, { title: "Shared note" });
  const sharedStored = (await notesOf(page)).map((note) => note.title);
  if (!sharedStored.includes("Shared note"))
    throw new Error(`shared note missing: ${sharedStored.join(",")}`);
  await other.reload();
  await other.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await other.getByRole("button", { name: "Notes", exact: true }).click();
  const otherNotes = other.getByRole("region", { name: "Notes" });
  await otherNotes.getByRole("button", { name: "Shared note" }).click();
  await otherNotes.locator("form").getByLabel("Title").waitFor();
  const mountedTitle = await otherNotes
    .locator("form")
    .getByLabel("Title")
    .inputValue();
  const firstEditor = page
    .getByRole("region", { name: "Notes" })
    .locator("form");
  await firstEditor.getByLabel("Title").fill("From tab A");
  await waitNote(page, { title: "From tab A" });
  const storedAfterA = (await notesOf(page)).find(
    (note) => note.title === "From tab A",
  );
  await otherNotes.locator("form").getByLabel("Title").fill("From tab B");
  await other.waitForTimeout(1200);
  const statusB = await otherNotes
    .locator("[data-save-status]")
    .getAttribute("data-save-status")
    .catch(() => "missing");
  const valueB = await otherNotes
    .locator("form")
    .getByLabel("Title")
    .inputValue()
    .catch(() => "missing");
  const duringConflict = (await notesOf(other)).find(
    (note) => note.title === "From tab A" || note.title === "From tab B",
  );
  const conflictText = await otherNotes
    .locator("[data-save-status]")
    .innerText()
    .catch(() => "");
  const conflictPassed =
    statusB === "conflict" &&
    conflictText.includes("Nothing was overwritten") &&
    duringConflict?.title === "From tab A" &&
    duringConflict?.revision === storedAfterA?.revision;
  record("two-tab-conflict", conflictPassed ? "PASS" : "FAIL", {
    mountedTitle,
    statusB,
    valueB,
    conflictText,
    storedTitle: duringConflict?.title,
    storedRevision: duringConflict?.revision,
    revisionAfterA: storedAfterA?.revision,
  });
  if (conflictPassed) {
    await otherNotes.getByRole("button", { name: "Keep my draft" }).click();
    await waitNote(other, { title: "From tab B" });
  }
  const kept = (await notesOf(other)).find(
    (note) => note.title === "From tab B",
  );
  record(
    "keep-my-draft",
    conflictPassed &&
      kept &&
      kept.revision === (storedAfterA?.revision ?? 0) + 1
      ? "PASS"
      : "FAIL",
    { title: kept?.title ?? null, revision: kept?.revision ?? null },
  );

  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const storedButton = page
    .getByRole("region", { name: "Notes" })
    .getByRole("button", { name: "From tab B" });
  if (await storedButton.count()) await storedButton.click();
  else
    await page
      .getByRole("region", { name: "Notes" })
      .getByRole("button", { name: "From tab A" })
      .click();
  await page
    .getByRole("region", { name: "Notes" })
    .locator("form")
    .getByLabel("Title")
    .fill("Stored side");
  await waitNote(page, { title: "Stored side" });
  const storedSide = (await notesOf(page)).find(
    (note) => note.title === "Stored side",
  );
  await otherNotes.locator("form").getByLabel("Title").fill("Draft side");
  await other.waitForTimeout(1200);
  const beforeUseStored = (await notesOf(other)).find(
    (note) => note.id === storedSide?.id,
  );
  const useStoredVisible = await otherNotes
    .getByRole("button", { name: "Use stored note" })
    .isVisible()
    .catch(() => false);
  if (useStoredVisible)
    await otherNotes.getByRole("button", { name: "Use stored note" }).click();
  await other.waitForTimeout(700);
  const afterUseStored = (await notesOf(other)).find(
    (note) => note.id === storedSide?.id,
  );
  const shownTitle = await otherNotes
    .locator("form")
    .getByLabel("Title")
    .inputValue();
  const statusAfter = await otherNotes
    .locator("[data-save-status]")
    .getAttribute("data-save-status");
  record(
    "use-stored-note",
    beforeUseStored?.title === "Stored side" &&
      afterUseStored?.title === "Stored side" &&
      afterUseStored?.revision === storedSide?.revision &&
      shownTitle === "Stored side" &&
      statusAfter === "saved"
      ? "PASS"
      : "FAIL",
    {
      before: beforeUseStored?.title,
      after: afterUseStored?.title,
      revision: afterUseStored?.revision,
      expectedRevision: storedSide?.revision,
      shownTitle,
      statusAfter,
    },
  );

  await page
    .getByRole("region", { name: "Notes" })
    .locator("form")
    .getByLabel("Title")
    .fill("Before failure");
  await waitNote(page, { title: "Before failure" });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function patched(value, key) {
      if (this.name === "notes") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException("simulated notes failure", "UnknownError");
      }
      return original.call(this, value, key);
    };
  });
  const failingEditor = page
    .getByRole("region", { name: "Notes" })
    .locator("form");
  await failingEditor.getByLabel("Title").fill("Should not replace");
  await failingEditor.locator("[data-save-status='error']").waitFor({
    timeout: 5000,
  });
  const afterFailure = (await notesOf(page)).find(
    (note) => note.id === storedSide?.id,
  );
  const draftValue = await failingEditor.getByLabel("Title").inputValue();
  record(
    "autosave-failure",
    afterFailure?.title === "Before failure" &&
      draftValue === "Should not replace"
      ? "PASS"
      : "FAIL",
    { stored: afterFailure?.title, draftValue },
  );

  await failingEditor.getByLabel("Title").fill("Pinned orbit");
  await waitNote(page, { title: "Pinned orbit" });
  await failingEditor.getByRole("button", { name: "Pin" }).click();
  await page.waitForTimeout(400);
  await failingEditor.getByLabel("Title").fill("Pinned orbit 2");
  await page.waitForTimeout(800);
  const afterPinEdit = (await notesOf(page)).find((note) =>
    note.title.startsWith("Pinned orbit"),
  );
  const pinEditStatus = await failingEditor
    .locator("[data-save-status]")
    .getAttribute("data-save-status");
  record(
    "edit-after-pin",
    afterPinEdit?.title === "Pinned orbit 2" &&
      afterPinEdit?.pinned === true &&
      pinEditStatus === "saved"
      ? "PASS"
      : "FAIL",
    {
      title: afterPinEdit?.title,
      pinned: afterPinEdit?.pinned,
      status: pinEditStatus,
    },
  );
  const pinned = (await notesOf(page)).find((note) =>
    note.title.startsWith("Pinned orbit"),
  );
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Edit layout" }).click();
  await page.getByLabel("Add widget").selectOption("notes");
  await page.getByRole("button", { name: "Done" }).click();
  const homeText = await page.locator("main").innerText();
  record(
    "pin-and-widget",
    pinned?.pinned === true && homeText.includes("Pinned orbit")
      ? "PASS"
      : "FAIL",
    {
      pinned: pinned?.pinned,
      revision: pinned?.revision,
      homeHasTitle: homeText.includes("Pinned orbit"),
    },
  );

  try {
    await page.getByRole("button", { name: "Notes", exact: true }).click();
    const lifecycle = page.getByRole("region", { name: "Notes" });
    const noteButton = lifecycle.getByRole("button", { name: "Pinned orbit" });
    if ((await noteButton.count()) > 0) await noteButton.click();
    else if ((await lifecycle.locator("form").count()) === 0)
      throw new Error(
        "Pinned orbit is not in the note list and no editor is open",
      );
    await lifecycle
      .locator("form")
      .getByRole("button", { name: "Archive" })
      .click();
    await page.waitForTimeout(400);
    const archived = (await notesOf(page)).find((note) =>
      note.title.startsWith("Pinned orbit"),
    );
    const activeText = await lifecycle.innerText();
    await lifecycle
      .locator("button[aria-pressed]")
      .filter({ hasText: "Archive" })
      .click();
    const archiveList = await lifecycle.innerText();
    const reopenArchive = lifecycle.getByRole("button", {
      name: "Pinned orbit",
    });
    if ((await reopenArchive.count()) > 0) await reopenArchive.click();
    await lifecycle
      .locator("form")
      .getByRole("button", { name: "Trash" })
      .click();
    await page.waitForTimeout(400);
    const trashed = (await notesOf(page)).find((note) =>
      note.title.startsWith("Pinned orbit"),
    );
    await lifecycle
      .locator("button[aria-pressed]")
      .filter({ hasText: "Trash" })
      .click();
    const trashList = await lifecycle.innerText();
    const reopenTrash = lifecycle.getByRole("button", { name: "Pinned orbit" });
    if ((await reopenTrash.count()) > 0) await reopenTrash.click();
    const restoreButton = lifecycle
      .locator("form")
      .getByRole("button", { name: "Restore" });
    if ((await restoreButton.count()) > 0) await restoreButton.click();
    await page.waitForTimeout(400);
    const restored = (await notesOf(page)).find((note) =>
      note.title.startsWith("Pinned orbit"),
    );
    const reopenActive = lifecycle.getByRole("button", {
      name: "Pinned orbit",
    });
    if ((await reopenActive.count()) > 0) await reopenActive.click();
    await lifecycle
      .locator("form")
      .getByRole("button", { name: "Archive" })
      .click();
    await page.waitForTimeout(400);
    const activeAgain = (await notesOf(page)).find((note) =>
      note.title.startsWith("Pinned orbit"),
    );
    await lifecycle
      .locator("button[aria-pressed]")
      .filter({ hasText: "Active" })
      .click();
    const backToActive = await lifecycle.innerText();
    record(
      "archive-trash-restore",
      archived?.archived === true &&
        !activeText.includes("Pinned orbit") &&
        archiveList.includes("Pinned orbit") &&
        trashed?.trashedAt &&
        trashList.includes("Pinned orbit") &&
        restored?.trashedAt === null &&
        restored?.archived === true &&
        activeAgain?.archived === false &&
        backToActive.includes("Pinned orbit")
        ? "PASS"
        : "FAIL",
      {
        archived: archived?.archived,
        activeListed: activeText.includes("Pinned orbit"),
        archiveListed: archiveList.includes("Pinned orbit"),
        trashedAt: Boolean(trashed?.trashedAt),
        trashListed: trashList.includes("Pinned orbit"),
        restoredTrash: restored?.trashedAt,
        restoredArchive: restored?.archived,
        unarchived: activeAgain?.archived,
        backToActive: backToActive.includes("Pinned orbit"),
        reopenedBeforeLaterActions: true,
      },
    );

    let parentId = null;
    for (let index = 0; index < 8; index += 1) {
      if (parentId) {
        const parent = (await rows(page, "folders")).values.find(
          (folder) => folder.id === parentId,
        );
        await lifecycle
          .getByRole("button", { name: parent.name, exact: true })
          .click();
      }
      await lifecycle.getByRole("button", { name: "New folder" }).click();
      await page.waitForFunction(async (count) => {
        const db = await new Promise((resolve) => {
          const request = indexedDB.open("Venus-p00");
          request.onsuccess = () => resolve(request.result);
        });
        const values = await new Promise((resolve) => {
          const request = db
            .transaction("folders")
            .objectStore("folders")
            .getAll();
          request.onsuccess = () => resolve(request.result);
        });
        db.close();
        return (
          values.filter((folder) => folder.scope === "notes").length >= count
        );
      }, index + 1);
      const created = (await rows(page, "folders")).values.filter(
        (folder) => folder.scope === "notes" && folder.parentId === parentId,
      );
      const folder = created[created.length - 1];
      const createdItem = lifecycle
        .getByRole("button", { name: "Folder", exact: true })
        .last()
        .locator("xpath=ancestor::li[1]");
      await createdItem.getByLabel("Rename").fill(`L${index}`);
      await createdItem
        .getByRole("button", { name: "Rename", exact: true })
        .click();
      await page.waitForFunction(async (name) => {
        const db = await new Promise((resolve) => {
          const request = indexedDB.open("Venus-p00");
          request.onsuccess = () => resolve(request.result);
        });
        const values = await new Promise((resolve) => {
          const request = db
            .transaction("folders")
            .objectStore("folders")
            .getAll();
          request.onsuccess = () => resolve(request.result);
        });
        db.close();
        return values.some((item) => item.name === name);
      }, `L${index}`);
      parentId = folder.id;
    }
    const folderRows = (await rows(page, "folders")).values.filter(
      (folder) => folder.scope === "notes",
    );
    const byId = new Map(folderRows.map((folder) => [folder.id, folder]));
    let depth = 0;
    let cursor = folderRows.find((folder) => folder.name === "L7");
    const seen = new Set();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      depth += 1;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : null;
    }
    const ninthBefore = folderRows.length;
    await lifecycle.getByRole("button", { name: "L7", exact: true }).click();
    await lifecycle.getByRole("button", { name: "New folder" }).click();
    await page.waitForTimeout(400);
    const afterNinth = (await rows(page, "folders")).values.filter(
      (folder) => folder.scope === "notes",
    );
    const l0Item = lifecycle
      .getByRole("button", { name: "L0", exact: true })
      .locator("xpath=ancestor::li[1]");
    const rootOptions = await l0Item
      .locator("xpath=./label[contains(., 'Parent folder')]//select")
      .locator("option")
      .allTextContents();
    const l2Item = lifecycle
      .getByRole("button", { name: "L2", exact: true })
      .locator("xpath=ancestor::li[1]");
    await l2Item
      .locator("xpath=./label[contains(., 'Parent folder')]//select")
      .selectOption({ label: "L0" });
    await page.waitForTimeout(400);
    const moved = (await rows(page, "folders")).values.find(
      (folder) => folder.name === "L2",
    );
    record(
      "folder-depth",
      depth === 8 && afterNinth.length === ninthBefore + 1 ? "PASS" : "FAIL",
      {
        depth,
        before: ninthBefore,
        after: afterNinth.length,
        enforcedMaximum: false,
      },
    );
    record(
      "folder-cycle-ui",
      !rootOptions.includes("L7") && moved?.parentId ? "PASS" : "FAIL",
      {
        rootOptions,
        movedParent: moved?.parentId ?? null,
        note: "The parent list omits the folder itself and its descendants. A valid move to L0 is stored.",
      },
    );
  } catch (error) {
    const text = await page
      .locator("main")
      .innerText()
      .catch(() => "");
    record(
      "notes-lifecycle",
      "FAIL",
      `${String(error).slice(0, 400)} | ${text.slice(0, 500)}`,
    );
  }

  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const tasks = page.getByRole("region", { name: "Tasks" });
  for (const title of [
    "Focus alpha",
    "Focus beta",
    "Focus gamma",
    "Focus extra",
  ]) {
    await tasks
      .locator("form")
      .filter({ hasText: "New task" })
      .getByLabel("Title")
      .fill(title);
    await tasks.getByRole("button", { name: "New task" }).click();
    await page.waitForFunction(async (name) => {
      const db = await new Promise((resolve) => {
        const request = indexedDB.open("Venus-p00");
        request.onsuccess = () => resolve(request.result);
      });
      const values = await new Promise((resolve) => {
        const request = db.transaction("tasks").objectStore("tasks").getAll();
        request.onsuccess = () => resolve(request.result);
      });
      db.close();
      return values.some((task) => task.title === name);
    }, title);
  }
  const ranks = ["1", "2", "3", "1"];
  const titles = ["Focus alpha", "Focus beta", "Focus gamma", "Focus extra"];
  for (let index = 0; index < titles.length; index += 1) {
    const item = tasks.locator("li").filter({ hasText: titles[index] });
    await item.getByLabel("Focus rank").selectOption(ranks[index]);
    await page.waitForTimeout(200);
  }
  const alphaItem = tasks.locator("li").filter({ hasText: "Focus alpha" });
  await alphaItem.getByLabel("Title").fill("Focus alpha renamed");
  await alphaItem.getByLabel("Details").fill("Bring the lens");
  await alphaItem.getByLabel("Priority").selectOption("1");
  await alphaItem.getByRole("button", { name: "Save task" }).click();
  await page.waitForTimeout(300);
  await tasks
    .locator("li")
    .filter({ hasText: "Focus alpha renamed" })
    .getByLabel("Due date")
    .fill("2026-10-12");
  await tasks
    .locator("li")
    .filter({ hasText: "Focus alpha renamed" })
    .getByLabel("Linked event id")
    .fill("not-a-uuid");
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  const priorityControl = await page
    .getByRole("region", { name: "Tasks" })
    .getByLabel("Priority")
    .count();
  const taskRows = (await rows(page, "tasks")).values;
  const alpha = taskRows.find((task) => task.title === "Focus alpha renamed");
  const extra = taskRows.find((task) => task.title === "Focus extra");
  const focusRanks = taskRows
    .filter((task) => task.focusRank)
    .map((task) => task.focusRank)
    .sort();
  record(
    "task-persists",
    alpha?.dueDate === "2026-10-12" &&
      alpha?.eventId === null &&
      alpha?.details === "Bring the lens" &&
      alpha?.priority === 1
      ? "PASS"
      : "FAIL",
    {
      dueDate: alpha?.dueDate,
      eventId: alpha?.eventId,
      details: alpha?.details,
      priority: alpha?.priority,
      priorityControl,
    },
  );
  record(
    "focus-top-three",
    focusRanks.join(",") === "1,2,3" && extra?.focusRank === null
      ? "PASS"
      : "FAIL",
    { focusRanks, extra: extra?.focusRank },
  );
  record(
    "task-priority-edit",
    priorityControl > 0 &&
      alpha?.priority === 1 &&
      alpha?.title === "Focus alpha renamed"
      ? "PASS"
      : "FAIL",
    {
      priorityControl,
      title: alpha?.title,
      priority: alpha?.priority,
    },
  );
  const taskScreen = page.getByRole("region", { name: "Tasks" });
  await taskScreen
    .locator("li")
    .filter({ hasText: "Focus alpha renamed" })
    .getByRole("button", { name: "Done" })
    .click();
  await page.waitForTimeout(300);
  const done = (await rows(page, "tasks")).values.find(
    (task) => task.title === "Focus alpha renamed",
  );
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const doneAfter = (await rows(page, "tasks")).values.find(
    (task) => task.title === "Focus alpha renamed",
  );
  record(
    "task-completion",
    done?.status === "done" &&
      done?.focusRank === null &&
      done?.completedAt &&
      doneAfter?.status === "done"
      ? "PASS"
      : "FAIL",
    {
      status: doneAfter?.status,
      focusRank: doneAfter?.focusRank,
      completedAt: Boolean(doneAfter?.completedAt),
    },
  );
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await taskScreen.getByRole("button", { name: "All", exact: true }).click();
  await taskScreen
    .locator("li")
    .filter({ hasText: "Focus alpha renamed" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.waitForTimeout(300);
  const reopened = (await rows(page, "tasks")).values.find(
    (task) => task.title === "Focus alpha renamed",
  );
  record(
    "task-reopen",
    reopened?.status === "open" && reopened?.completedAt === null
      ? "PASS"
      : "FAIL",
    { status: reopened?.status, completedAt: reopened?.completedAt ?? null },
  );

  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  const bookmarks = page.getByRole("region", { name: "Bookmarks" });
  await bookmarks.getByLabel("Title").fill("Bad");
  await bookmarks.getByLabel("Address").fill("javascript:alert(1)");
  await bookmarks.getByRole("button", { name: "Save local bookmark" }).click();
  const rejected = await bookmarks.locator(".error").innerText();
  await bookmarks.getByLabel("Title").fill("File");
  await bookmarks.getByLabel("Address").fill("file:///etc/passwd");
  await bookmarks.getByRole("button", { name: "Save local bookmark" }).click();
  await bookmarks.getByRole("button", { name: "New bookmark folder" }).click();
  await page.waitForTimeout(300);
  await bookmarks
    .getByLabel("Bookmark folder")
    .first()
    .selectOption({ index: 1 });
  await bookmarks.getByLabel("Title").first().fill("Docs");
  await bookmarks
    .getByLabel("Address")
    .first()
    .fill("https://example.com/docs");
  await bookmarks.getByRole("button", { name: "Save local bookmark" }).click();
  await bookmarks.getByRole("link", { name: "Docs", exact: true }).waitFor();
  const createdBookmark = (await rows(page, "localBookmarks")).values.find(
    (item) => item.title === "Docs",
  );
  const bookmarkRow = bookmarks.locator("li").filter({ hasText: "Docs" });
  await bookmarkRow.getByLabel("Title").fill("Docs renamed");
  await bookmarkRow.getByRole("button", { name: "Save bookmark" }).click();
  await page.waitForTimeout(300);
  const renamedBookmark = (await rows(page, "localBookmarks")).values.find(
    (item) => item.id === createdBookmark?.id,
  );
  await bookmarkRow
    .getByRole("button", { name: "Confirm local bookmark removal" })
    .click();
  await bookmarkRow
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await page.waitForTimeout(300);
  const localBookmarks = (await rows(page, "localBookmarks")).values;
  const inactive = await bookmarks.innerText();
  const folderCreate = await bookmarks
    .getByRole("button", { name: "New folder" })
    .count();
  record(
    "bookmark-url-and-permission",
    rejected.includes("was not saved") &&
      inactive.includes("Browser bookmarks are inactive") &&
      !inactive.includes("Permission was not granted") &&
      localBookmarks.length === 0
      ? "PASS"
      : "FAIL",
    {
      rejected,
      inactiveIsNotDenial: inactive.includes("not a recorded denial"),
      stored: localBookmarks.map((item) => item.url),
      bookmarkFolderButton: folderCreate,
      renamed: renamedBookmark?.title ?? null,
      folderId: renamedBookmark?.folderId ?? null,
    },
  );
  const bookmarkFolders = (await rows(page, "folders")).values.filter(
    (folder) => folder.scope === "localBookmarks",
  );
  record(
    "local-bookmark-folders",
    bookmarkFolders.length > 0 &&
      renamedBookmark?.title === "Docs renamed" &&
      renamedBookmark?.folderId &&
      localBookmarks.length === 0
      ? "PASS"
      : "FAIL",
    {
      folders: bookmarkFolders.map((folder) => folder.name),
      title: renamedBookmark?.title ?? null,
      folderId: renamedBookmark?.folderId ?? null,
      remaining: localBookmarks.length,
    },
  );
  const confirmVisible = await bookmarks
    .getByLabel("I confirm this browser bookmark change")
    .count();
  record(
    "browser-bookmark-confirmation-without-permission",
    confirmVisible === 0 && inactive.includes("Browser bookmarks are inactive")
      ? "PASS"
      : "FAIL",
    "The confirmation control is not shown while browser bookmarks are inactive. This is not a native grant, denial, revoke, or browser-bookmark mutation.",
  );
  await bookmarks.getByRole("button", { name: "Request permission" }).click();
  await page.waitForTimeout(500);
  const requestNote = await bookmarks.getByRole("status").innerText();
  record("bookmark-permission-request-ui", "INFO", {
    note: requestNote,
    label:
      "Controlled UI outcome only. Native grant, denial, and revoke remain NOT VERIFIED.",
  });

  await page.getByRole("button", { name: "Quick capture" }).click();
  const capture = page.getByRole("dialog", { name: "Quick capture" });
  await capture.getByRole("button", { name: "Note", exact: true }).click();
  await capture.getByLabel("Title").fill("Captured note");
  await capture
    .getByLabel("Details")
    .fill("<script>window.__venusXss=2</script>Captured body");
  await capture.getByRole("button", { name: "Save", exact: true }).click();
  await capture.getByText("Saved on this device.").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Commands" }).click();
  const palette = page.getByRole("dialog", { name: "Commands" });
  await palette.getByPlaceholder("Filter commands").fill("New task");
  await palette.getByRole("button", { name: /New task/ }).click();
  const captureAgain = page.getByRole("dialog", { name: "Quick capture" });
  await captureAgain.getByLabel("Title").fill("Captured task");
  await captureAgain.getByLabel("Details").fill("Task details");
  await captureAgain.getByRole("button", { name: "Save", exact: true }).click();
  await captureAgain.getByText("Saved on this device.").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Quick capture" }).click();
  await page.getByRole("button", { name: "Event", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Quick capture" })
    .getByLabel("Title")
    .fill("Later");
  await page
    .getByRole("dialog", { name: "Quick capture" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  const eventText = await page
    .getByRole("dialog", { name: "Quick capture" })
    .innerText();
  await page.keyboard.press("Escape");
  const capturedNote = (await notesOf(page)).find(
    (note) => note.title === "Captured note",
  );
  const capturedTask = (await rows(page, "tasks")).values.find(
    (task) => task.title === "Captured task",
  );
  const captureXss = await page.evaluate(() => window.__venusXss ?? 0);
  record(
    "quick-capture",
    capturedNote &&
      JSON.stringify(capturedNote.body).includes("Captured body") &&
      !JSON.stringify(capturedNote.body).includes("<script") &&
      capturedTask?.details === "Task details" &&
      eventText.includes("was not saved") &&
      captureXss !== 2
      ? "PASS"
      : "FAIL",
    {
      note: Boolean(capturedNote),
      taskDetails: capturedTask?.details,
      eventText: eventText.slice(0, 180),
      captureXss,
    },
  );
  record(
    "event-draft-not-saved",
    eventText.includes("was not saved") ? "PASS" : "FAIL",
    eventText.slice(0, 240),
  );

  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await page.locator("#dashboard-search").fill("Captured note");
  await page.getByRole("button", { name: "Search on this device" }).click();
  const searchText = await page
    .getByRole("region", { name: "Local results" })
    .innerText();
  await page.getByRole("button", { name: "Search the web" }).click();
  const offlineNotice = await page.getByRole("status").innerText();
  record(
    "local-search",
    searchText.includes("Captured note") &&
      searchText.includes("note") &&
      offlineNotice.includes("Offline")
      ? "PASS"
      : "FAIL",
    { searchText: searchText.slice(0, 200), offlineNotice },
  );

  await page.locator("#dashboard-search").focus();
  await page.keyboard.press("Control+k");
  const blocked = await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible();
  await page.locator("h1").click();
  await page.keyboard.press("Control+k");
  const commands = page.getByRole("dialog", { name: "Commands" });
  await commands.getByPlaceholder("Filter commands").fill("New");
  await page.keyboard.press("ArrowDown");
  const selected = await commands.locator("[aria-selected='true']").innerText();
  await page.keyboard.press("Enter");
  const entered = await page
    .getByRole("dialog", { name: "Quick capture" })
    .isVisible()
    .catch(() => false);
  if (entered) await page.keyboard.press("Escape");
  const closed = !(await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible()
    .catch(() => false));
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  const escaped = !(await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible()
    .catch(() => false));
  record(
    "command-palette",
    blocked === false && selected.length > 0 && closed && escaped
      ? "PASS"
      : "FAIL",
    { blocked, selected, enteredCapture: entered, closed, escaped },
  );

  await page.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    stored["venus.bootstrap"].locale = "fa";
    await chrome.storage.local.set(stored);
  });
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const direction = await page.evaluate(() => document.documentElement.dir);
  await page.getByRole("button", { name: "نشانک‌ها" }).click();
  const faBookmarks = page.getByRole("region", { name: "نشانک‌ها" });
  await faBookmarks.getByLabel("عنوان").fill("خانه");
  await faBookmarks.getByLabel("نشانی").fill("https://example.com/fa");
  await faBookmarks.getByRole("button", { name: "ذخیره نشانک محلی" }).click();
  await faBookmarks.getByRole("link", { name: "خانه", exact: true }).waitFor();
  const faText = await faBookmarks.innerText();
  await page.getByRole("button", { name: "یادداشت‌ها" }).click();
  const faNotes = await page
    .getByRole("region", { name: "یادداشت‌ها" })
    .innerText();
  record(
    "fa-bookmarks",
    direction === "rtl" && faText.includes("ونوس") && faText.includes("خانه")
      ? "PASS"
      : "FAIL",
    {
      direction,
      hasSource: faText.includes("ونوس"),
      faNotes: faNotes.includes("خانه") === false,
    },
  );

  await page.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    stored["venus.bootstrap"].locale = "en";
    await chrome.storage.local.set(stored);
  });
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.getByLabel("Web search provider").selectOption("custom");
  await options
    .getByLabel("Search template")
    .fill("http://example.test/?q={query}");
  await options.getByRole("button", { name: "Save search provider" }).click();
  const rejectedTemplate = await options.locator(".error").innerText();
  await options
    .getByLabel("Search template")
    .fill("https://example.test/search?q={query}");
  await options.getByRole("button", { name: "Save search provider" }).click();
  await options.locator(".success").waitFor();
  const provider = await options.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return {
      id: stored["venus.bootstrap"].searchProviderId,
      template: stored["venus.bootstrap"].customSearchTemplate,
    };
  });
  record(
    "search-provider",
    rejectedTemplate.includes("https") &&
      provider.id === "custom" &&
      provider.template === "https://example.test/search?q={query}"
      ? "PASS"
      : "FAIL",
    { rejectedTemplate, provider },
  );
  const selectedBefore = await options.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return stored["venus.bootstrap"].selectedProfileId;
  });
  await options.getByLabel("Create profile").fill("Spare profile");
  await options.getByRole("button", { name: "Minimal" }).click();
  await options.waitForTimeout(400);
  const profiles = (await rows(options, "profiles")).values;
  const spare = profiles.find((item) => item.title === "Spare profile");
  const selectedAfterCreate = await options.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return stored["venus.bootstrap"].selectedProfileId;
  });
  record(
    "profile-switch-and-unselected-delete-ui",
    spare && selectedAfterCreate === selectedBefore ? "PARTIAL" : "FAIL",
    {
      selectedBefore,
      selectedAfterCreate,
      spare: spare?.id ?? null,
      reason:
        "Creating a profile leaves the previous selection in place. Settings only deletes the profile currently open, which is the selected profile. Deleting an unselected profile is not available in this screen.",
    },
  );
} catch (error) {
  record("browser-run", "FAIL", String(error));
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}

const migrationProfile = await mkdtemp(join(tmpdir(), "venus-p02-migrate-"));
const migrationExtension = await mkdtemp(join(tmpdir(), "venus-p02-ext-"));
await cp(extension, migrationExtension, { recursive: true });
await writeFile(
  join(migrationExtension, "background.js"),
  "self.addEventListener('install', () => undefined);\n",
);
const migration = await launch(migrationProfile, migrationExtension);
await migration.addInitScript(() => {
  if (!location.pathname.includes("newtab")) return;
  const nativeOpen = indexedDB.open.bind(indexedDB);
  let seedFinished = false;
  const queued = [];
  indexedDB.open = function opened(name, version) {
    if (name !== "Venus-p00" || seedFinished) return nativeOpen(name, version);
    const handlers = {};
    const listeners = [];
    let real = null;
    const facade = {
      addEventListener(type, handler, options) {
        listeners.push([type, handler, options]);
        if (real) real.addEventListener(type, handler, options);
      },
      removeEventListener(type, handler, options) {
        if (real) real.removeEventListener(type, handler, options);
      },
    };
    for (const key of [
      "onerror",
      "onblocked",
      "onupgradeneeded",
      "onsuccess",
    ]) {
      Object.defineProperty(facade, key, {
        configurable: true,
        get() {
          return handlers[key];
        },
        set(handler) {
          handlers[key] = handler;
          if (real) real[key] = handler;
        },
      });
    }
    for (const key of ["result", "error", "transaction", "readyState"]) {
      Object.defineProperty(facade, key, {
        get() {
          return real ? real[key] : undefined;
        },
      });
    }
    queued.push(() => {
      real =
        version === undefined ? nativeOpen(name) : nativeOpen(name, version);
      for (const key of Object.keys(handlers)) real[key] = handlers[key];
      for (const [type, handler, options] of listeners)
        real.addEventListener(type, handler, options);
    });
    return facade;
  };
  const probe = {
    id: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
    dueAt: 5,
    state: "pending",
    native: "not_attempted",
  };
  const profileId = "11111111-1111-4111-8111-111111111111";
  const legacyRequest = nativeOpen("Venus-p00", 20);
  legacyRequest.onupgradeneeded = () => {
    const db = legacyRequest.result;
    const define = (name, indexes) => {
      const store = db.createObjectStore(name, { keyPath: "id" });
      for (const index of indexes) store.createIndex(index, index);
    };
    define("probes", ["state", "dueAt"]);
    define("profiles", ["updatedAt"]);
    define("widgets", ["profileId"]);
    define("sharedItems", ["kind"]);
    define("assets", []);
  };
  legacyRequest.onerror = () => {
    window.__seedStatus = String(legacyRequest.error);
    seedFinished = true;
    indexedDB.open = nativeOpen;
    for (const open of queued) open();
  };
  legacyRequest.onsuccess = () => {
    const legacy = legacyRequest.result;
    const tx = legacy.transaction(
      ["probes", "profiles", "widgets", "sharedItems"],
      "readwrite",
    );
    tx.objectStore("probes").put(probe);
    tx.objectStore("profiles").put({
      id: profileId,
      title: "Kept appearance",
      preset: "personal",
      themeMode: "dark",
      wallpaper: { kind: "scene", sceneId: "nebula" },
      blurPx: 4,
      glassAlpha: 0.72,
      accent: "#445566",
      revision: 2,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    tx.objectStore("widgets").put({
      id: "22222222-2222-4222-8222-222222222222",
      profileId,
      widgetType: "clock",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
      settings: {},
      revision: 1,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    tx.objectStore("sharedItems").put({
      id: "33333333-3333-4333-8333-333333333333",
      kind: "note",
      title: "Shared survivor",
      revision: 1,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    tx.oncomplete = () => {
      legacy.close();
      seedFinished = true;
      window.__seedStatus = "seeded";
      indexedDB.open = nativeOpen;
      for (const open of queued) open();
    };
    tx.onerror = () => {
      window.__seedStatus = String(tx.error);
      seedFinished = true;
      indexedDB.open = nativeOpen;
      for (const open of queued) open();
    };
  };
});
try {
  const page = await openNewTab(migration);
  const setupVisible = await page
    .getByRole("button", { name: "Skip setup" })
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (setupVisible) await skip(page);
  const seeded = {
    probeId: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
    profileId: "11111111-1111-4111-8111-111111111111",
  };
  const migrated = await page.evaluate(async (ids) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    async function all(store) {
      return new Promise((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
    }
    const result = {
      version: db.version,
      names: [...db.objectStoreNames],
      seedStatus: window.__seedStatus ?? "missing",
      probe: (await all("probes")).find((row) => row.id === ids.probeId),
      profile: (await all("profiles")).find((row) => row.id === ids.profileId),
      widget: (await all("widgets")).find(
        (row) => row.id === "22222222-2222-4222-8222-222222222222",
      ),
      shared: (await all("sharedItems")).find(
        (row) => row.title === "Shared survivor",
      ),
    };
    db.close();
    return result;
  }, seeded);
  const required = [
    "notes",
    "folders",
    "tasks",
    "localBookmarks",
    "bookmarkSnapshots",
    "probes",
    "profiles",
    "widgets",
    "sharedItems",
    "assets",
  ];
  const upgraded =
    migrated.version === 30 &&
    migrated.seedStatus === "seeded" &&
    migrated.probe?.state === "pending" &&
    migrated.profile?.title === "Kept appearance" &&
    migrated.widget?.widgetType === "clock" &&
    migrated.shared?.title === "Shared survivor" &&
    required.every((name) => migrated.names.includes(name));
  record("dexie-v3-migration", upgraded ? "PASS" : "FAIL", {
    version: migrated.version,
    names: migrated.names,
    storesPresent: required.every((name) => migrated.names.includes(name)),
    seedStatus: migrated.seedStatus,
    probe: migrated.probe?.state ?? null,
    profile: migrated.profile?.title ?? null,
    widget: migrated.widget?.widgetType ?? null,
    shared: migrated.shared?.title ?? null,
    indexedDbSeedVersion: 20,
    note: "Dexie schema version 2 is IndexedDB version 20. The migration profile loads a background script that does not open the database, so the page can seed version 20 before Dexie opens version 30.",
  });
} catch (error) {
  record("dexie-v3-migration", "FAIL", String(error));
} finally {
  await migration.close();
  await rm(migrationProfile, { recursive: true, force: true });
  await rm(migrationExtension, { recursive: true, force: true });
}

await writeFile(
  resolve(evidenceDir, "results.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      browser: version,
      offline: true,
      nativeBookmarkLifecycle: "NOT VERIFIED",
      checks,
    },
    null,
    2,
  ),
);
if (checks.some((check) => check.status === "FAIL")) process.exit(1);
