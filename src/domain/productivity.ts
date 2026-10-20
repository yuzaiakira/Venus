import { z } from "zod";
import { WorkspaceError } from "./dashboard";

const textLimit = 100_000;
const titleLimit = 300;

export const noteMarkSchema = z.union([
  z.object({ type: z.enum(["bold", "italic"]) }).strict(),
  z
    .object({
      type: z.literal("link"),
      href: z.string().min(1).max(2000),
    })
    .strict(),
]);
export const noteTextSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().max(textLimit),
    marks: z.array(noteMarkSchema).max(8).optional(),
  })
  .strict();
const inlineSchema = z.array(noteTextSchema).max(200);
export const noteBlockSchema = z.union([
  z
    .object({
      type: z.enum(["paragraph", "heading"]),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      content: inlineSchema,
    })
    .strict(),
  z
    .object({
      type: z.enum(["bulletList", "orderedList"]),
      content: z
        .array(
          z
            .object({ type: z.literal("listItem"), content: inlineSchema })
            .strict(),
        )
        .max(200),
    })
    .strict(),
  z
    .object({
      type: z.literal("taskList"),
      content: z
        .array(
          z
            .object({
              type: z.literal("taskItem"),
              checked: z.boolean(),
              content: inlineSchema,
            })
            .strict(),
        )
        .max(200),
    })
    .strict(),
]);
export const noteDocumentSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(noteBlockSchema).max(500),
  })
  .strict();

export interface NoteText {
  type: "text";
  text: string;
  marks?: ({ type: "bold" | "italic" } | { type: "link"; href: string })[];
}
export type NoteBlock =
  | { type: "paragraph"; content: NoteText[] }
  | { type: "heading"; level: 1 | 2 | 3; content: NoteText[] }
  | { type: "bulletList"; content: { type: "listItem"; content: NoteText[] }[] }
  | {
      type: "orderedList";
      content: { type: "listItem"; content: NoteText[] }[];
    }
  | {
      type: "taskList";
      content: { type: "taskItem"; checked: boolean; content: NoteText[] }[];
    };
export interface NoteDocument {
  type: "doc";
  content: NoteBlock[];
}

const stampSchema = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};

export const folderSchema = z
  .object({
    ...stampSchema,
    scope: z.enum(["notes", "localBookmarks"]),
    parentId: z.string().uuid().nullable(),
    name: z.string().min(1).max(80),
    sortIndex: z.number().int(),
  })
  .strict();
export const noteSchema = z
  .object({
    ...stampSchema,
    title: z.string().max(titleLimit),
    body: z.custom<NoteDocument>(
      (value) => noteDocumentSchema.safeParse(value).success,
    ),
    folderId: z.string().uuid().nullable(),
    tags: z.array(z.string().min(1).max(40)).max(16),
    pinned: z.boolean(),
    archived: z.boolean(),
    trashedAt: z.string().nullable(),
  })
  .strict();
export const taskSchema = z
  .object({
    ...stampSchema,
    title: z.string().min(1).max(titleLimit),
    details: z.string().max(textLimit),
    status: z.enum(["open", "done"]),
    priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    eventId: z.string().uuid().nullable(),
    focusRank: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    completedAt: z.string().nullable(),
  })
  .strict();
export const localBookmarkSchema = z
  .object({
    ...stampSchema,
    title: z.string().min(1).max(titleLimit),
    url: z.string().min(1).max(2000),
    folderId: z.string().uuid().nullable(),
    iconLabel: z.string().min(1).max(8).nullable(),
    sortOrder: z.number().int(),
    quick: z.boolean(),
  })
  .strict();
export const bookmarkSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    portablePath: z.string().max(1000),
    title: z.string().max(titleLimit),
    url: z.string().max(2000).nullable(),
    sourceBrowser: z.string().min(1).max(40),
    capturedAt: z.string().min(1),
  })
  .strict();

export type FolderRecord = z.infer<typeof folderSchema>;
export type NoteRecord = z.infer<typeof noteSchema>;
export type TaskRecord = z.infer<typeof taskSchema>;
export type LocalBookmarkRecord = z.infer<typeof localBookmarkSchema>;
export type BookmarkSnapshotRecord = z.infer<typeof bookmarkSnapshotSchema>;

export interface BrowserBookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BrowserBookmarkNode[];
}

export function emptyDocument(text = ""): NoteDocument {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: textNodes(text) }],
  };
}

export function textNodes(text: string) {
  if (!text) return [];
  return [{ type: "text" as const, text }];
}

export function pastedPlainText(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

export function documentFromPlainText(value: string): NoteDocument {
  const text = pastedPlainText(value).slice(0, textLimit);
  return noteDocumentSchema.parse(emptyDocument(text)) as NoteDocument;
}

export function blockPlain(block: NoteBlock) {
  if (block.type === "paragraph" || block.type === "heading")
    return block.content.map((node) => node.text).join("");
  return block.content
    .map((item) => item.content.map((node) => node.text).join(""))
    .join("\n");
}

export function applyBlockLink(
  block: NoteBlock,
  href: string | null,
): NoteBlock {
  const marksFor = (marks: NoteText["marks"] | undefined) => {
    const kept = (marks ?? []).filter((mark) => mark.type !== "link");
    if (href === null) return kept.length > 0 ? kept : undefined;
    const next = [...kept, { type: "link" as const, href: safeLink(href) }];
    return next;
  };
  const mapNodes = (nodes: NoteText[]): NoteText[] =>
    nodes.map((node) => {
      const marks = marksFor(node.marks);
      if (!marks) return { type: "text" as const, text: node.text };
      return { ...node, marks };
    });
  if (block.type === "paragraph" || block.type === "heading")
    return { ...block, content: mapNodes(block.content) };
  if (block.type === "taskList")
    return {
      ...block,
      content: block.content.map((item) => ({
        ...item,
        content: mapNodes(item.content),
      })),
    };
  return {
    ...block,
    content: block.content.map((item) => ({
      ...item,
      content: mapNodes(item.content),
    })),
  };
}

export function replaceBlockText(block: NoteBlock, text: string): NoteBlock {
  const source =
    block.type === "paragraph" || block.type === "heading"
      ? block.content[0]
      : block.content[0]?.content[0];
  const marks = source?.marks;
  const node: NoteText = { type: "text", text };
  if (marks) node.marks = marks;
  const content = text ? [node] : [];
  if (block.type === "paragraph" || block.type === "heading")
    return { ...block, content };
  if (block.type === "taskList") {
    return {
      ...block,
      content: [
        {
          type: "taskItem",
          checked: block.content[0]?.checked ?? false,
          content,
        },
      ],
    };
  }
  if (block.type === "bulletList" || block.type === "orderedList")
    return { ...block, content: [{ type: "listItem", content }] };
  return block;
}

export function plainText(document: NoteDocument) {
  const parts: string[] = [];
  for (const block of document.content) {
    if (block.type === "paragraph" || block.type === "heading") {
      parts.push(block.content.map((node) => node.text).join(""));
    } else {
      for (const item of block.content)
        parts.push(item.content.map((node) => node.text).join(""));
    }
  }
  return parts.join("\n");
}

export function safeLink(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WorkspaceError("invalidInput");
  }
  if (
    url.protocol !== "https:" &&
    url.protocol !== "http:" &&
    url.protocol !== "mailto:"
  )
    throw new WorkspaceError("invalidInput");
  return url.href;
}

export function canonicalHttpUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new WorkspaceError("invalidInput");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new WorkspaceError("invalidInput");
  return url.href;
}

export function validateNoteDocument(document: NoteDocument) {
  const parsed = noteDocumentSchema.parse(document) as NoteDocument;
  for (const block of parsed.content) {
    const nodes =
      block.type === "paragraph" || block.type === "heading"
        ? block.content
        : block.content.flatMap((item) => item.content);
    for (const node of nodes) {
      for (const mark of node.marks ?? []) {
        if (mark.type === "link") safeLink(mark.href);
      }
    }
  }
  return parsed;
}

export function folderDepth(
  folders: Pick<FolderRecord, "id" | "parentId">[],
  id: string,
) {
  let depth = 1;
  let current = folders.find((folder) => folder.id === id);
  const seen = new Set<string>();
  while (current?.parentId) {
    if (seen.has(current.id)) throw new WorkspaceError("invalidInput");
    seen.add(current.id);
    depth += 1;
    current = folders.find((folder) => folder.id === current?.parentId);
  }
  return depth;
}

export function folderCycle(
  folders: Pick<FolderRecord, "id" | "parentId">[],
  id: string,
  parentId: string | null,
) {
  if (parentId === null) return false;
  if (parentId === id) return true;
  const seen = new Set<string>([id]);
  let cursor: string | null = parentId;
  while (cursor) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = folders.find((folder) => folder.id === cursor)?.parentId ?? null;
  }
  return false;
}

export function descendantIds(
  folders: Pick<FolderRecord, "id" | "parentId">[],
  id: string,
) {
  const ids = [id];
  for (let index = 0; index < ids.length; index += 1) {
    for (const folder of folders) {
      if (folder.parentId === ids[index]) ids.push(folder.id);
    }
  }
  return ids;
}

const dueDate = /^\d{4}-\d{2}-\d{2}$/;
export function validDueDate(value: string | null) {
  if (value === null) return null;
  if (!dueDate.test(value)) throw new WorkspaceError("invalidInput");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new WorkspaceError("invalidInput");
  return value;
}

export function optionalEventId(value: string | null) {
  if (value === null || value === "") return null;
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function normalizeTags(tags: string[]) {
  const next = tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 16);
  if (next.some((tag) => tag.length > 40))
    throw new WorkspaceError("invalidInput");
  return next;
}

export function searchFold(value: string) {
  return value
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک");
}

export interface SearchHit {
  id: string;
  kind: "note" | "task" | "bookmark" | "command";
  title: string;
  detail: string;
}

export function searchLibrary(
  input: {
    notes: NoteRecord[];
    tasks: TaskRecord[];
    bookmarks: LocalBookmarkRecord[];
    commands: { id: string; label: string }[];
  },
  query: string,
) {
  const needle = searchFold(query.trim());
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const note of input.notes) {
    if (note.trashedAt) continue;
    const body = plainText(note.body);
    if (
      searchFold(`${note.title}\n${body}\n${note.tags.join(" ")}`).includes(
        needle,
      )
    )
      hits.push({ id: note.id, kind: "note", title: note.title, detail: body });
  }
  for (const task of input.tasks) {
    if (searchFold(`${task.title}\n${task.details}`).includes(needle))
      hits.push({
        id: task.id,
        kind: "task",
        title: task.title,
        detail: task.details,
      });
  }
  for (const bookmark of input.bookmarks) {
    if (searchFold(`${bookmark.title}\n${bookmark.url}`).includes(needle))
      hits.push({
        id: bookmark.id,
        kind: "bookmark",
        title: bookmark.title,
        detail: bookmark.url,
      });
  }
  for (const command of input.commands) {
    if (searchFold(command.label).includes(needle))
      hits.push({
        id: command.id,
        kind: "command",
        title: command.label,
        detail: "",
      });
  }
  return hits;
}

export function focusTasks(tasks: TaskRecord[]) {
  return tasks
    .filter((task) => task.status === "open" && task.focusRank !== null)
    .sort((a, b) => (a.focusRank ?? 0) - (b.focusRank ?? 0))
    .slice(0, 3);
}

/** Dashboard Today widget: prefer Top Three focus, else open tasks by priority. */
export function previewTodayTasks(tasks: TaskRecord[]) {
  const focus = focusTasks(tasks);
  if (focus.length > 0) return focus;
  return tasks
    .filter((task) => task.status === "open")
    .sort(
      (a, b) =>
        a.priority - b.priority || b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 3);
}

/** Dashboard notes widget: pinned first, then recent active notes. */
export function previewNotes(notes: NoteRecord[], limit = 2) {
  return notes
    .filter((note) => !note.archived && note.trashedAt === null)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, limit);
}

/** Dashboard quick links: marked quick first, else recent bookmarks. */
export function previewQuickLinks(
  bookmarks: LocalBookmarkRecord[],
  limit = 6,
) {
  const quick = bookmarks.filter((bookmark) => bookmark.quick);
  if (quick.length > 0) return quick.slice(0, limit);
  return [...bookmarks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function snapshotFromTree(
  nodes: BrowserBookmarkNode[],
  sourceBrowser: string,
  capturedAt: string,
  createId: () => string,
) {
  const rows: BookmarkSnapshotRecord[] = [];
  const walk = (items: BrowserBookmarkNode[], parents: string[]) => {
    for (const node of items) {
      let url: string | null = null;
      if (node.url) {
        try {
          url = canonicalHttpUrl(node.url);
        } catch {
          continue;
        }
      }
      const path = [...parents, node.title];
      rows.push(
        bookmarkSnapshotSchema.parse({
          id: createId(),
          portablePath: path.join("/"),
          title: node.title,
          url,
          sourceBrowser,
          capturedAt,
        }),
      );
      if (node.children) walk(node.children, path);
    }
  };
  walk(nodes, []);
  return rows;
}

export function iconFallback(title: string, iconLabel: string | null) {
  const chosen = iconLabel?.trim();
  if (chosen) return chosen;
  const first = Array.from(title.trim())[0];
  return first || "?";
}
