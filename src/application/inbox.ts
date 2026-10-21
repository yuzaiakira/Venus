import { WorkspaceError } from "../domain/dashboard";
import {
  classifyInbox,
  draftForInbox,
  inboxDraftSchema,
  inboxItemSchema,
  type InboxDraft,
  type InboxItemRecord,
  type InboxKind,
} from "../domain/inbox";
import { documentFromPlainText } from "../domain/productivity";
import type { ProfileRecord } from "../domain/dashboard";
import type { Productivity, RowTable } from "./productivity";
import type { createCalendar } from "./calendar";
import type { WorkspaceChange } from "./workspace";

export interface InboxDatabase {
  profiles: RowTable<ProfileRecord>;
  inboxItems: RowTable<InboxItemRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface InboxWorkspace {
  items: InboxItemRecord[];
  pending: InboxItemRecord[];
  accepted: InboxItemRecord[];
  rejected: InboxItemRecord[];
  undone: InboxItemRecord[];
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

export function createInbox(
  database: InboxDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
  destinations: {
    productivity: Productivity;
    calendar: ReturnType<typeof createCalendar>;
  },
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function requireProfile(profileId: string) {
    if (!(await database.profiles.get(profileId)))
      throw new WorkspaceError("notFound");
  }
  async function requireItem(profileId: string, id: string, expected: number) {
    const current = await database.inboxItems.get(id);
    if (!current || current.profileId !== profileId)
      throw new WorkspaceError("notFound");
    if (current.revision !== expected) throw new WorkspaceError("conflict");
    return current;
  }
  async function load(profileId: string): Promise<InboxWorkspace> {
    await requireProfile(profileId);
    const items = (await database.inboxItems.toArray())
      .filter((item) => item.profileId === profileId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return {
      items,
      pending: items.filter((item) => item.status === "pending"),
      accepted: items.filter((item) => item.status === "accepted"),
      rejected: items.filter((item) => item.status === "rejected"),
      undone: items.filter((item) => item.status === "undone"),
    };
  }
  async function create(
    profileId: string,
    content: string,
    timeZone: string,
    now = Date.now(),
  ) {
    const text = content.trim();
    const local = classifyInbox(text, timeZone, now);
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const next = inboxItemSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          source: "manual",
          content: text,
          suggestion: local.suggestion,
          selectedKind: local.suggestion.kind,
          draft: local.draft,
          status: "pending",
          destination: null,
          operation: null,
          rejectedAt: null,
          acceptedAt: null,
          undoneAt: null,
          ...stamp(),
        });
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function reclassify(
    profileId: string,
    id: string,
    expected: number,
    kind: InboxKind,
    timeZone: string,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        if (current.status !== "pending" || current.operation)
          throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, {
            selectedKind: kind,
            draft: draftForInbox(kind, current.content, timeZone),
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function updateDraft(
    profileId: string,
    id: string,
    expected: number,
    draft: InboxDraft,
  ) {
    const parsed = inboxDraftSchema.parse(draft);
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        if (current.status !== "pending" || current.operation)
          throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, { selectedKind: parsed.kind, draft: parsed }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function prepareAcceptance(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        if (current.status !== "pending") throw new WorkspaceError("conflict");
        if (current.operation?.state === "creating") return current;
        if (current.operation) throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, {
            operation: {
              id: crypto.randomUUID(),
              destinationId: crypto.randomUUID(),
              state: "creating",
            },
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function ensureDestination(item: InboxItemRecord) {
    const operation = item.operation;
    if (!operation) throw new WorkspaceError("conflict");
    const id = operation.destinationId;
    if (item.draft.kind === "task") {
      const created = await destinations.productivity.createTask(
        item.draft.title,
        item.draft.details,
        item.draft.today,
        id,
      );
      const next = await destinations.productivity.saveTask(
        created.id,
        created.revision,
        {
          priority: item.draft.priority,
          dueDate: item.draft.dueDate,
        },
      );
      return { kind: "task" as const, id: next.id, revision: next.revision };
    }
    if (item.draft.kind === "note") {
      const created = await destinations.productivity.createNote({
        id,
        title: item.draft.title,
        body: documentFromPlainText(item.draft.content),
        folderId: null,
        tags: item.draft.tags,
      });
      return {
        kind: "note" as const,
        id: created.id,
        revision: created.revision,
      };
    }
    if (!item.draft.date || (!item.draft.allDay && !item.draft.time))
      throw new WorkspaceError("invalidInput");
    const [year, month, day] = item.draft.date.split("-").map(Number);
    const [hour, minute] = (item.draft.time ?? "00:00").split(":").map(Number);
    const created = await destinations.calendar.createEvent({
      id,
      title: item.draft.title,
      description: item.draft.description,
      basis: "gregorian",
      allDay: item.draft.allDay,
      localDate: {
        calendar: "gregorian",
        year: year!,
        month: month!,
        day: day!,
      },
      wall: item.draft.allDay
        ? null
        : { hour: hour!, minute: minute!, second: 0 },
      zoneId: item.draft.timeZone,
      offsetMinutes: [],
    });
    return {
      kind: "event" as const,
      id: created.id,
      revision: created.revision,
    };
  }
  async function accept(profileId: string, id: string, expected: number) {
    const prepared = await prepareAcceptance(profileId, id, expected);
    const destination = await ensureDestination(prepared);
    const row = await database.transaction(
      "rw",
      [database.inboxItems],
      async () => {
        const current = await database.inboxItems.get(id);
        if (!current || current.profileId !== profileId)
          throw new WorkspaceError("notFound");
        if (current.status === "accepted") return current;
        if (
          current.status !== "pending" ||
          !current.operation ||
          current.operation.id !== prepared.operation?.id
        )
          throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, {
            status: "accepted",
            destination,
            operation: { ...current.operation, state: "completed" },
            acceptedAt: new Date().toISOString(),
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function reject(profileId: string, id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        if (current.status !== "pending" || current.operation)
          throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, {
            status: "rejected",
            rejectedAt: new Date().toISOString(),
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function restore(profileId: string, id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        if (!["rejected", "undone"].includes(current.status))
          throw new WorkspaceError("conflict");
        const next = inboxItemSchema.parse(
          bump(current, {
            status: "pending",
            destination: null,
            operation: null,
            rejectedAt: null,
            acceptedAt: null,
            undoneAt: null,
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function destinationRecord(
    destination: NonNullable<InboxItemRecord["destination"]>,
  ) {
    if (destination.kind === "task")
      return (
        (await destinations.productivity.load()).tasks.find(
          (row) => row.id === destination.id,
        ) ?? null
      );
    if (destination.kind === "note")
      return (
        (await destinations.productivity.load()).notes.find(
          (row) => row.id === destination.id,
        ) ?? null
      );
    return (
      (await destinations.calendar.list()).events.find(
        (row) => row.id === destination.id,
      ) ?? null
    );
  }
  async function undo(profileId: string, id: string, expected: number) {
    const item = await requireItem(profileId, id, expected);
    if (item.status !== "accepted" || !item.destination)
      throw new WorkspaceError("conflict");
    const record = await destinationRecord(item.destination);
    // A retry after a crash may find that the prior attempt already removed the
    // destination. The UUID was generated by this inbox operation, so marking
    // the source undone is safe and prevents a recovery loop.
    if (record && record.revision !== item.destination.revision)
      throw new WorkspaceError("conflict");
    if (record && item.destination.kind === "task")
      await destinations.productivity.deleteTask(
        item.destination.id,
        item.destination.revision!,
      );
    else if (record && item.destination.kind === "note")
      await destinations.productivity.saveNote(
        item.destination.id,
        item.destination.revision!,
        {
          trashedAt: new Date().toISOString(),
        },
      );
    else if (record)
      await destinations.calendar.deleteEvent(
        item.destination.id,
        item.destination.revision!,
      );
    const row = await database.transaction(
      "rw",
      [database.inboxItems],
      async () => {
        const current = await requireItem(profileId, id, expected);
        const next = inboxItemSchema.parse(
          bump(current, {
            status: "undone",
            undoneAt: new Date().toISOString(),
          }),
        );
        await database.inboxItems.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function remove(
    profileId: string,
    id: string,
    expected: number,
    confirmed: boolean,
  ) {
    if (!confirmed) throw new WorkspaceError("invalidInput");
    const row = await database.transaction(
      "rw",
      [database.profiles, database.inboxItems],
      async () => {
        await requireProfile(profileId);
        const current = await requireItem(profileId, id, expected);
        await database.inboxItems.delete(current.id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  return {
    load,
    create,
    reclassify,
    updateDraft,
    accept,
    reject,
    restore,
    undo,
    remove,
  };
}

export type Inbox = ReturnType<typeof createInbox>;
