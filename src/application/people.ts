import { WorkspaceError, type ProfileRecord } from "../domain/dashboard";
import {
  followUpSchema,
  followUpState,
  interactionSchema,
  personSchema,
  type ContactMethod,
  type FollowUpPriority,
  type FollowUpQueueState,
  type FollowUpRecord,
  type InteractionRecord,
  type PersonRecord,
} from "../domain/people";
import type { RowTable } from "./productivity";
import type { WorkspaceChange } from "./workspace";

export interface PeopleDatabase {
  profiles: RowTable<ProfileRecord>;
  people: RowTable<PersonRecord>;
  followUps: RowTable<FollowUpRecord>;
  interactions: RowTable<InteractionRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}

export interface PersonDetails extends PersonRecord {
  followUps: FollowUpEntry[];
  interactions: InteractionRecord[];
  nextFollowUp: FollowUpEntry | null;
}

export interface FollowUpEntry extends FollowUpRecord {
  person: PersonRecord | null;
  queueState: FollowUpQueueState;
}

export interface PeopleWorkspace {
  people: PersonDetails[];
  activePeople: PersonDetails[];
  archivedPeople: PersonDetails[];
  followUps: FollowUpEntry[];
  overdue: FollowUpEntry[];
  due: FollowUpEntry[];
  upcoming: FollowUpEntry[];
  snoozed: FollowUpEntry[];
  completed: FollowUpEntry[];
}

export type FollowUpFilters = Partial<{
  status: FollowUpRecord["status"];
  priority: FollowUpPriority;
  contactMethod: ContactMethod;
}>;

export interface FollowUpReminderSynchronizer {
  syncFollowUp(id: string): Promise<void>;
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
function cleanNullable(value: string | null | undefined) {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}
function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

export function createPeople(
  database: PeopleDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
  reminders?: FollowUpReminderSynchronizer,
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }
  async function requireProfile(profileId: string) {
    if (!(await database.profiles.get(profileId)))
      throw new WorkspaceError("notFound");
  }
  async function requirePerson(id: string, profileId?: string) {
    const row = await database.people.get(id);
    if (!row || (profileId && row.profileId !== profileId))
      throw new WorkspaceError("notFound");
    return row;
  }
  async function requireFollowUp(id: string, profileId?: string) {
    const row = await database.followUps.get(id);
    if (!row || (profileId && row.profileId !== profileId))
      throw new WorkspaceError("notFound");
    return row;
  }
  async function sync(id: string) {
    await reminders?.syncFollowUp(id);
  }

  async function load(profileId: string, today: string, nowUTC = Date.now()) {
    await requireProfile(profileId);
    const [peopleRows, followUpRows, interactions] = await Promise.all([
      database.people.toArray(),
      database.followUps.toArray(),
      database.interactions.toArray(),
    ]);
    const people = peopleRows.filter(
      (person) => person.profileId === profileId,
    );
    const peopleById = new Map(people.map((person) => [person.id, person]));
    const followUps = followUpRows
      .filter((row) => row.profileId === profileId)
      .filter((row) => peopleById.has(row.personId))
      .map((row) => ({
        ...row,
        person: peopleById.get(row.personId) ?? null,
        queueState: followUpState(row, today, nowUTC),
      }))
      .sort((left, right) => {
        const stateOrder = {
          overdue: 0,
          due: 1,
          snoozed: 2,
          upcoming: 3,
          completed: 4,
        } as const;
        return (
          stateOrder[left.queueState] - stateOrder[right.queueState] ||
          left.dueDate.localeCompare(right.dueDate) ||
          left.title.localeCompare(right.title)
        );
      });
    const profileInteractions = interactions
      .filter((item) => item.profileId === profileId)
      .filter((item) => peopleById.has(item.personId))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const details = people
      .map((person) => {
        const personFollowUps = followUps.filter(
          (followUp) => followUp.personId === person.id,
        );
        const nextFollowUp =
          personFollowUps.find((followUp) =>
            ["overdue", "due", "snoozed", "upcoming"].includes(
              followUp.queueState,
            ),
          ) ?? null;
        return {
          ...person,
          followUps: personFollowUps,
          interactions: profileInteractions.filter(
            (item) => item.personId === person.id,
          ),
          nextFollowUp,
        };
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
    return {
      people: details,
      activePeople: details.filter((person) => person.status === "active"),
      archivedPeople: details.filter((person) => person.status === "archived"),
      followUps,
      overdue: followUps.filter((row) => row.queueState === "overdue"),
      due: followUps.filter((row) => row.queueState === "due"),
      upcoming: followUps.filter((row) => row.queueState === "upcoming"),
      snoozed: followUps.filter((row) => row.queueState === "snoozed"),
      completed: followUps.filter((row) => row.queueState === "completed"),
    } satisfies PeopleWorkspace;
  }

  async function createPerson(
    profileId: string,
    draft: Omit<
      PersonRecord,
      "id" | "profileId" | "revision" | "createdAt" | "updatedAt" | "status"
    > & { status?: PersonRecord["status"] },
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.people],
      async () => {
        await requireProfile(profileId);
        const next = personSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          displayName: draft.displayName.trim(),
          organization: cleanNullable(draft.organization),
          role: cleanNullable(draft.role),
          email: cleanNullable(draft.email)?.toLowerCase() ?? null,
          phone: cleanNullable(draft.phone),
          tags: cleanTags(draft.tags),
          relationshipNotes: draft.relationshipNotes.trim(),
          status: draft.status ?? "active",
          ...stamp(),
        });
        await database.people.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }

  async function updatePerson(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        PersonRecord,
        | "displayName"
        | "organization"
        | "role"
        | "email"
        | "phone"
        | "tags"
        | "relationshipNotes"
        | "status"
      >
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.people],
      async () => {
        const current = await requirePerson(id);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = personSchema.parse(
          bump(current, {
            displayName:
              patch.displayName === undefined
                ? current.displayName
                : patch.displayName.trim(),
            organization:
              patch.organization === undefined
                ? current.organization
                : cleanNullable(patch.organization),
            role:
              patch.role === undefined
                ? current.role
                : cleanNullable(patch.role),
            email:
              patch.email === undefined
                ? current.email
                : (cleanNullable(patch.email)?.toLowerCase() ?? null),
            phone:
              patch.phone === undefined
                ? current.phone
                : cleanNullable(patch.phone),
            tags:
              patch.tags === undefined ? current.tags : cleanTags(patch.tags),
            relationshipNotes:
              patch.relationshipNotes === undefined
                ? current.relationshipNotes
                : patch.relationshipNotes.trim(),
            status: patch.status ?? current.status,
          }),
        );
        await database.people.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }

  async function archivePerson(id: string, expected: number) {
    return updatePerson(id, expected, { status: "archived" });
  }

  async function deletePerson(
    id: string,
    expected: number,
    confirmed: boolean,
  ) {
    if (!confirmed) throw new WorkspaceError("invalidInput");
    const followUpIds = await database.transaction(
      "rw",
      [database.people, database.followUps, database.interactions],
      async () => {
        const person = await requirePerson(id);
        if (person.revision !== expected) throw new WorkspaceError("conflict");
        const linked = (await database.followUps.toArray()).filter(
          (followUp) =>
            followUp.personId === id && followUp.profileId === person.profileId,
        );
        for (const interaction of await database.interactions.toArray())
          if (
            interaction.personId === id &&
            interaction.profileId === person.profileId
          )
            await database.interactions.delete(interaction.id);
        for (const followUp of linked)
          await database.followUps.delete(followUp.id);
        await database.people.delete(id);
        return linked.map((followUp) => followUp.id);
      },
    );
    for (const followUpId of followUpIds) await sync(followUpId);
    changed(id, expected + 1);
  }

  async function createFollowUp(
    profileId: string,
    draft: Omit<
      FollowUpRecord,
      | "id"
      | "profileId"
      | "revision"
      | "createdAt"
      | "updatedAt"
      | "status"
      | "completedAt"
      | "snoozedUntilUTC"
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.people, database.followUps],
      async () => {
        await requireProfile(profileId);
        const person = await requirePerson(draft.personId, profileId);
        if (person.status === "archived")
          throw new WorkspaceError("invalidInput");
        const next = followUpSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          personId: person.id,
          title: draft.title.trim(),
          dueDate: draft.dueDate,
          dueTime: draft.dueTime,
          timeZone: draft.timeZone,
          priority: draft.priority,
          contactMethod: draft.contactMethod,
          reminderEnabled: draft.reminderEnabled,
          status: "open",
          snoozedUntilUTC: null,
          completedAt: null,
          ...stamp(),
        });
        await database.followUps.put(next);
        return next;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision);
    return row;
  }

  async function updateFollowUp(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        FollowUpRecord,
        | "title"
        | "dueDate"
        | "dueTime"
        | "timeZone"
        | "priority"
        | "contactMethod"
        | "reminderEnabled"
      >
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.people, database.followUps],
      async () => {
        const current = await requireFollowUp(id);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const person = await requirePerson(current.personId, current.profileId);
        if (person.status === "archived")
          throw new WorkspaceError("invalidInput");
        const next = followUpSchema.parse(
          bump(current, {
            title:
              patch.title === undefined ? current.title : patch.title.trim(),
            dueDate: patch.dueDate ?? current.dueDate,
            dueTime:
              patch.dueTime === undefined ? current.dueTime : patch.dueTime,
            timeZone: patch.timeZone ?? current.timeZone,
            priority: patch.priority ?? current.priority,
            contactMethod: patch.contactMethod ?? current.contactMethod,
            reminderEnabled: patch.reminderEnabled ?? current.reminderEnabled,
            snoozedUntilUTC: null,
          }),
        );
        await database.followUps.put(next);
        return next;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision);
    return row;
  }

  async function completeFollowUp(id: string, expected?: number) {
    const row = await database.transaction(
      "rw",
      [database.people, database.followUps],
      async () => {
        const current = await requireFollowUp(id);
        await requirePerson(current.personId, current.profileId);
        if (current.status === "completed") return current;
        if (expected !== undefined && current.revision !== expected)
          throw new WorkspaceError("conflict");
        const next = followUpSchema.parse(
          bump(current, {
            status: "completed",
            completedAt: new Date().toISOString(),
            snoozedUntilUTC: null,
          }),
        );
        await database.followUps.put(next);
        return next;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision);
    return row;
  }

  async function reopenFollowUp(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.followUps],
      async () => {
        const current = await requireFollowUp(id);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        const next = followUpSchema.parse(
          bump(current, {
            status: "open",
            completedAt: null,
            snoozedUntilUTC: null,
          }),
        );
        await database.followUps.put(next);
        return next;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision);
    return row;
  }

  async function postponeFollowUp(
    id: string,
    expected: number,
    untilUTC: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.followUps],
      async () => {
        const current = await requireFollowUp(id);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        if (current.status !== "open" || untilUTC <= Date.now())
          throw new WorkspaceError("invalidInput");
        const next = followUpSchema.parse(
          bump(current, { snoozedUntilUTC: Math.trunc(untilUTC) }),
        );
        await database.followUps.put(next);
        return next;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision);
    return row;
  }

  async function deleteFollowUp(id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.followUps, database.interactions],
      async () => {
        const current = await requireFollowUp(id);
        if (current.revision !== expected) throw new WorkspaceError("conflict");
        for (const interaction of await database.interactions.toArray())
          if (interaction.followUpId === id)
            await database.interactions.delete(interaction.id);
        await database.followUps.delete(id);
        return current;
      },
    );
    await sync(row.id);
    changed(row.id, row.revision + 1);
  }

  async function recordInteraction(
    profileId: string,
    draft: Omit<InteractionRecord, "id" | "profileId" | "createdAt">,
  ) {
    const row = await database.transaction(
      "rw",
      [
        database.profiles,
        database.people,
        database.followUps,
        database.interactions,
      ],
      async () => {
        await requireProfile(profileId);
        await requirePerson(draft.personId, profileId);
        if (draft.followUpId) {
          const followUp = await requireFollowUp(draft.followUpId, profileId);
          if (followUp.personId !== draft.personId)
            throw new WorkspaceError("invalidInput");
        }
        const next = interactionSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          personId: draft.personId,
          followUpId: draft.followUpId,
          kind: draft.kind,
          body: draft.body.trim(),
          occurredAt: draft.occurredAt,
          createdAt: new Date().toISOString(),
        });
        await database.interactions.put(next);
        return next;
      },
    );
    changed(row.id, 1);
    return row;
  }

  async function searchPeople(profileId: string, query: string) {
    const data = await load(profileId, "9999-12-31");
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return data.people;
    return data.people.filter((person) =>
      [
        person.displayName,
        person.organization,
        person.role,
        person.email,
        person.phone,
        person.relationshipNotes,
        ...person.tags,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle)),
    );
  }

  function filterFollowUps(rows: FollowUpEntry[], filters: FollowUpFilters) {
    return rows.filter(
      (row) =>
        (filters.status === undefined || row.status === filters.status) &&
        (filters.priority === undefined || row.priority === filters.priority) &&
        (filters.contactMethod === undefined ||
          row.contactMethod === filters.contactMethod),
    );
  }

  return {
    load,
    createPerson,
    updatePerson,
    archivePerson,
    deletePerson,
    createFollowUp,
    updateFollowUp,
    completeFollowUp,
    reopenFollowUp,
    postponeFollowUp,
    deleteFollowUp,
    recordInteraction,
    searchPeople,
    filterFollowUps,
  };
}

export type People = ReturnType<typeof createPeople>;
