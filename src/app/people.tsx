import { useEffect, useMemo, useState } from "react";
import type {
  FollowUpEntry,
  People,
  PeopleWorkspace,
  PersonDetails,
} from "../application/people";
import type {
  ContactMethod,
  FollowUpPriority,
  InteractionRecord,
  PersonRecord,
} from "../domain/people";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
function nowIso() {
  return new Date().toISOString();
}
function displayDate(
  date: string,
  locale: Locale,
  timeZone: string,
  time?: string | null,
) {
  const value = new Date(`${date}T${time ?? "12:00"}:00Z`);
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-u-nu-arabext" : "en", {
    timeZone,
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" as const } : {}),
  }).format(value);
}

export function PeopleScreen(props: {
  profileId: string;
  data: PeopleWorkspace;
  people: People;
  calendarPermission: () => Promise<"granted" | "denied" | "missing">;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  requestNotificationPermission: () => Promise<
    "granted" | "denied" | "dismissed" | "failed" | "unsupported"
  >;
  focusFollowUpId?: string | null;
}) {
  const t = (key: MessageKey, values?: Record<string, string>) =>
    translate(props.locale, key, values);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<{
    status: "" | "open" | "completed";
    priority: "" | FollowUpPriority;
    method: "" | ContactMethod;
  }>({ status: "open", priority: "", method: "" });
  const [permission, setPermission] = useState<
    "granted" | "denied" | "missing"
  >("missing");

  useEffect(() => {
    void props
      .calendarPermission()
      .then(setPermission)
      .catch(() => setPermission("missing"));
  }, [props.calendarPermission]);
  useEffect(() => {
    if (props.focusFollowUpId) {
      const row = props.data.followUps.find(
        (item) => item.id === props.focusFollowUpId,
      );
      if (row) setSelectedId(row.personId);
    }
  }, [props.focusFollowUpId, props.data.followUps]);
  useEffect(() => {
    if (
      selectedId &&
      !props.data.people.some((person) => person.id === selectedId)
    )
      setSelectedId(null);
  }, [selectedId, props.data.people]);

  const peopleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return props.data.activePeople;
    return props.data.activePeople.filter((person) =>
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
  }, [props.data.activePeople, query]);
  const selected =
    props.data.people.find((person) => person.id === selectedId) ??
    peopleRows[0] ??
    null;
  const filteredFollowUps = props.people.filterFollowUps(props.data.followUps, {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.priority ? { priority: filter.priority } : {}),
    ...(filter.method ? { contactMethod: filter.method } : {}),
  });

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await props.onChanged();
      setNotice(t("people.saved"));
    } catch {
      setError(t("people.saveFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function requestPermission() {
    const result = await props.requestNotificationPermission();
    if (result === "granted") setPermission("granted");
    else if (result === "denied") setPermission("denied");
    else setPermission("missing");
  }

  return (
    <section className="content-card module" aria-labelledby="people-heading">
      <div className="page-header">
        <div>
          <h1 id="people-heading">{t("people.heading")}</h1>
          <p className="muted">{t("people.intro")}</p>
        </div>
        <button
          className="btn primary"
          type="button"
          onClick={() => setCreating(true)}
        >
          {t("people.addPerson")}
        </button>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("people.offline")}
        </p>
      ) : null}
      {permission === "granted" ? (
        <p className="muted" role="status">
          {t("people.permissionGranted")}
        </p>
      ) : (
        <div className="cluster" role="status">
          <p className="muted">
            {permission === "denied"
              ? t("people.permissionDenied")
              : t("people.permissionMissing")}
          </p>
          <button
            className="btn"
            type="button"
            onClick={() => void requestPermission()}
          >
            {t("people.permissionAction")}
          </button>
        </div>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" role="status">
          {notice}
        </p>
      ) : null}
      {creating ? (
        <section
          className="task-card card-glass"
          aria-label={t("people.addPerson")}
        >
          <PersonEditor
            locale={props.locale}
            busy={busy}
            onCancel={() => setCreating(false)}
            onSave={(draft) =>
              void run(async () => {
                const row = await props.people.createPerson(
                  props.profileId,
                  draft,
                );
                setSelectedId(row.id);
                setCreating(false);
              })
            }
          />
        </section>
      ) : null}
      <section className="task-card card-glass" aria-label={t("people.search")}>
        <label>
          {t("people.search")}
          <input
            className="field"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {!peopleRows.length ? (
          <p className="muted">{t("people.empty")}</p>
        ) : null}
        <div className="cluster" aria-label={t("people.search")}>
          {peopleRows.map((person) => (
            <button
              key={person.id}
              className={`btn${selected?.id === person.id ? " primary" : ""}`}
              type="button"
              onClick={() => setSelectedId(person.id)}
            >
              <bdi>{person.displayName}</bdi>
            </button>
          ))}
        </div>
      </section>
      {selected ? (
        <PersonWorkspace
          person={selected}
          locale={props.locale}
          timeZone={props.timeZone}
          busy={busy}
          people={props.people}
          profileId={props.profileId}
          onChanged={props.onChanged}
          onRun={run}
          onDeleted={() => setSelectedId(null)}
        />
      ) : null}
      <section
        className="task-card card-glass"
        aria-labelledby="follow-up-queue"
      >
        <div className="page-header">
          <h2 id="follow-up-queue">{t("people.followUps")}</h2>
          <div className="cluster">
            <label>
              {t("people.status.open")}
              <select
                className="select"
                value={filter.status}
                onChange={(event) =>
                  setFilter((current) => ({
                    ...current,
                    status: event.target.value as "" | "open" | "completed",
                  }))
                }
              >
                <option value="">{t("people.filter")}</option>
                <option value="open">{t("people.status.open")}</option>
                <option value="completed">
                  {t("people.status.completed")}
                </option>
              </select>
            </label>
            <label>
              {t("people.priority")}
              <select
                className="select"
                value={filter.priority}
                onChange={(event) =>
                  setFilter((current) => ({
                    ...current,
                    priority: event.target.value as "" | FollowUpPriority,
                  }))
                }
              >
                <option value="">{t("people.filter")}</option>
                <option value="low">{t("people.priority.low")}</option>
                <option value="normal">{t("people.priority.normal")}</option>
                <option value="high">{t("people.priority.high")}</option>
              </select>
            </label>
            <label>
              {t("people.method")}
              <select
                className="select"
                value={filter.method}
                onChange={(event) =>
                  setFilter((current) => ({
                    ...current,
                    method: event.target.value as "" | ContactMethod,
                  }))
                }
              >
                <option value="">{t("people.filter")}</option>
                <MethodOptions t={t} />
              </select>
            </label>
          </div>
        </div>
        <FollowUpQueue
          rows={filteredFollowUps}
          locale={props.locale}
          timeZone={props.timeZone}
          busy={busy}
          onOpen={(row) => setSelectedId(row.personId)}
          onComplete={(row) =>
            void run(() => props.people.completeFollowUp(row.id, row.revision))
          }
          onReopen={(row) =>
            void run(() => props.people.reopenFollowUp(row.id, row.revision))
          }
          onSnooze={(row) =>
            void run(() =>
              props.people.postponeFollowUp(
                row.id,
                row.revision,
                Date.now() + 60 * 60_000,
              ),
            )
          }
        />
      </section>
      <section
        className="task-card card-glass"
        aria-labelledby="archived-people"
      >
        <h2 id="archived-people">{t("people.archived")}</h2>
        {!props.data.archivedPeople.length ? (
          <p className="muted">{t("people.noArchived")}</p>
        ) : null}
        <ul className="task-list">
          {props.data.archivedPeople.map((person) => (
            <li key={person.id} className="task-row">
              <bdi>{person.displayName}</bdi>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    props.people.updatePerson(person.id, person.revision, {
                      status: "active",
                    }),
                  )
                }
              >
                {t("people.restore")}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function PersonWorkspace(props: {
  person: PersonDetails;
  locale: Locale;
  timeZone: string;
  profileId: string;
  busy: boolean;
  people: People;
  onChanged: () => Promise<void>;
  onRun: (work: () => Promise<unknown>) => Promise<void>;
  onDeleted: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [editing, setEditing] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpEntry | null>(
    null,
  );
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <section
      className="task-card card-glass"
      aria-labelledby={`person-${props.person.id}`}
    >
      <div className="page-header">
        <div>
          <h2 id={`person-${props.person.id}`}>
            <bdi>{props.person.displayName}</bdi>
          </h2>
          <p className="muted">
            {[props.person.role, props.person.organization]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="cluster">
          <button
            className="btn"
            type="button"
            onClick={() => setEditing((value) => !value)}
          >
            {t("people.edit")}
          </button>
          <button
            className="btn"
            type="button"
            disabled={props.busy}
            onClick={() =>
              void props.onRun(async () => {
                await props.people.archivePerson(
                  props.person.id,
                  props.person.revision,
                );
                props.onDeleted();
              })
            }
          >
            {t("people.archive")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setConfirming(true)}
          >
            {t("people.delete")}
          </button>
        </div>
      </div>
      {confirming ? (
        <div className="cluster" role="alert">
          <p>{t("people.confirmDelete")}</p>
          <button
            className="btn primary"
            type="button"
            onClick={() =>
              void props.onRun(async () => {
                await props.people.deletePerson(
                  props.person.id,
                  props.person.revision,
                  true,
                );
                props.onDeleted();
              })
            }
          >
            {t("people.delete")}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setConfirming(false)}
          >
            {t("people.cancel")}
          </button>
        </div>
      ) : null}
      {editing ? (
        <PersonEditor
          person={props.person}
          locale={props.locale}
          busy={props.busy}
          onCancel={() => setEditing(false)}
          onSave={(draft) =>
            void props.onRun(async () => {
              await props.people.updatePerson(
                props.person.id,
                props.person.revision,
                draft,
              );
              setEditing(false);
            })
          }
        />
      ) : (
        <div className="cluster">
          {props.person.email ? (
            <p>
              <bdi>{props.person.email}</bdi>
            </p>
          ) : null}
          {props.person.phone ? (
            <p>
              <bdi>{props.person.phone}</bdi>
            </p>
          ) : null}
          {props.person.tags.map((tag) => (
            <span className="muted" key={tag}>
              #{tag}
            </span>
          ))}
          {props.person.relationshipNotes ? (
            <p className="muted">
              <bdi>{props.person.relationshipNotes}</bdi>
            </p>
          ) : null}
        </div>
      )}
      <div className="page-header">
        <h3>{t("people.followUps")}</h3>
        <button
          className="btn primary"
          type="button"
          onClick={() => setAddingFollowUp((value) => !value)}
        >
          {t("people.addFollowUp")}
        </button>
      </div>
      {addingFollowUp ? (
        <FollowUpEditor
          locale={props.locale}
          timeZone={props.timeZone}
          busy={props.busy}
          onCancel={() => setAddingFollowUp(false)}
          onSave={(draft) =>
            void props.onRun(async () => {
              await props.people.createFollowUp(props.profileId, {
                ...draft,
                personId: props.person.id,
              });
              setAddingFollowUp(false);
            })
          }
        />
      ) : null}
      {editingFollowUp ? (
        <FollowUpEditor
          followUp={editingFollowUp}
          locale={props.locale}
          timeZone={props.timeZone}
          busy={props.busy}
          onCancel={() => setEditingFollowUp(null)}
          onSave={(draft) =>
            void props.onRun(async () => {
              await props.people.updateFollowUp(
                editingFollowUp.id,
                editingFollowUp.revision,
                draft,
              );
              setEditingFollowUp(null);
            })
          }
        />
      ) : null}
      <FollowUpQueue
        rows={props.person.followUps}
        locale={props.locale}
        timeZone={props.timeZone}
        busy={props.busy}
        onOpen={() => undefined}
        onComplete={(row) =>
          void props.onRun(() =>
            props.people.completeFollowUp(row.id, row.revision),
          )
        }
        onReopen={(row) =>
          void props.onRun(() =>
            props.people.reopenFollowUp(row.id, row.revision),
          )
        }
        onSnooze={(row) =>
          void props.onRun(() =>
            props.people.postponeFollowUp(
              row.id,
              row.revision,
              Date.now() + 60 * 60_000,
            ),
          )
        }
        onEdit={setEditingFollowUp}
        onDelete={(row) =>
          window.confirm(t("repair.confirmDelete")) &&
          void props.onRun(() =>
            props.people.deleteFollowUp(row.id, row.revision),
          )
        }
      />
      <div className="page-header">
        <h3>{t("people.interactions")}</h3>
        <button
          className="btn"
          type="button"
          onClick={() => setAddingInteraction((value) => !value)}
        >
          {t("people.addInteraction")}
        </button>
      </div>
      {addingInteraction ? (
        <InteractionEditor
          locale={props.locale}
          busy={props.busy}
          onCancel={() => setAddingInteraction(false)}
          onSave={(draft) =>
            void props.onRun(async () => {
              await props.people.recordInteraction(props.profileId, {
                ...draft,
                personId: props.person.id,
              });
              setAddingInteraction(false);
            })
          }
        />
      ) : null}
      {!props.person.interactions.length ? (
        <p className="muted">{t("people.noInteractions")}</p>
      ) : null}
      <ul className="task-list">
        {props.person.interactions.map((interaction) => (
          <li key={interaction.id} className="task-row">
            <span>
              <bdi>{interaction.body}</bdi>
            </span>
            <small className="muted">
              {displayDate(
                interaction.occurredAt.slice(0, 10),
                props.locale,
                props.timeZone,
              )}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonEditor(props: {
  person?: PersonRecord;
  locale: Locale;
  busy: boolean;
  onSave: (
    draft: Omit<
      PersonRecord,
      "id" | "profileId" | "revision" | "createdAt" | "updatedAt"
    >,
  ) => void;
  onCancel: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [displayName, setDisplayName] = useState(
    props.person?.displayName ?? "",
  );
  const [organization, setOrganization] = useState(
    props.person?.organization ?? "",
  );
  const [role, setRole] = useState(props.person?.role ?? "");
  const [email, setEmail] = useState(props.person?.email ?? "");
  const [phone, setPhone] = useState(props.person?.phone ?? "");
  const [tags, setTags] = useState(props.person?.tags.join(", ") ?? "");
  const [relationshipNotes, setRelationshipNotes] = useState(
    props.person?.relationshipNotes ?? "",
  );
  return (
    <div className="cluster">
      <label>
        {t("people.name")}
        <input
          className="field"
          autoFocus
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>
      <label>
        {t("people.organization")}
        <input
          className="field"
          value={organization}
          onChange={(event) => setOrganization(event.target.value)}
        />
      </label>
      <label>
        {t("people.role")}
        <input
          className="field"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
      </label>
      <label>
        {t("people.email")}
        <input
          className="field"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        {t("people.phone")}
        <input
          className="field"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <label>
        {t("people.tags")}
        <input
          className="field"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </label>
      <label>
        {t("people.relationshipNotes")}
        <textarea
          className="field"
          value={relationshipNotes}
          onChange={(event) => setRelationshipNotes(event.target.value)}
        />
      </label>
      <button
        className="btn primary"
        type="button"
        disabled={props.busy || !displayName.trim()}
        onClick={() =>
          props.onSave({
            displayName,
            organization: organization || null,
            role: role || null,
            email: email || null,
            phone: phone || null,
            tags: tags.split(","),
            relationshipNotes,
            status: props.person?.status ?? "active",
          })
        }
      >
        {t("people.save")}
      </button>
      <button className="btn" type="button" onClick={props.onCancel}>
        {t("people.cancel")}
      </button>
    </div>
  );
}

function FollowUpEditor(props: {
  followUp?: FollowUpEntry;
  locale: Locale;
  timeZone: string;
  busy: boolean;
  onSave: (draft: {
    title: string;
    dueDate: string;
    dueTime: string | null;
    timeZone: string;
    priority: FollowUpPriority;
    contactMethod: ContactMethod;
    reminderEnabled: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState(props.followUp?.title ?? "");
  const [dueDate, setDueDate] = useState(
    props.followUp?.dueDate ?? localDate(props.timeZone),
  );
  const [dueTime, setDueTime] = useState(props.followUp?.dueTime ?? "09:00");
  const [timeZone, setTimeZone] = useState(
    props.followUp?.timeZone ?? props.timeZone,
  );
  const [priority, setPriority] = useState<FollowUpPriority>(
    props.followUp?.priority ?? "normal",
  );
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    props.followUp?.contactMethod ?? "message",
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    props.followUp?.reminderEnabled ?? false,
  );
  return (
    <div className="cluster">
      <label>
        {t("people.reason")}
        <input
          className="field"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        {t("people.dueDate")}
        <input
          className="field"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <label>
        {t("people.dueTime")}
        <input
          className="field"
          type="time"
          value={dueTime}
          onChange={(event) => setDueTime(event.target.value)}
        />
      </label>
      <label>
        {t("people.timeZone")}
        <input
          className="field"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
        />
      </label>
      <label>
        {t("people.priority")}
        <select
          className="select"
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as FollowUpPriority)
          }
        >
          <option value="low">{t("people.priority.low")}</option>
          <option value="normal">{t("people.priority.normal")}</option>
          <option value="high">{t("people.priority.high")}</option>
        </select>
      </label>
      <label>
        {t("people.method")}
        <select
          className="select"
          value={contactMethod}
          onChange={(event) =>
            setContactMethod(event.target.value as ContactMethod)
          }
        >
          <MethodOptions t={t} />
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={reminderEnabled}
          onChange={(event) => setReminderEnabled(event.target.checked)}
        />{" "}
        {t("people.enableReminder")}
      </label>
      <button
        className="btn primary"
        type="button"
        disabled={props.busy || !title.trim()}
        onClick={() =>
          props.onSave({
            title,
            dueDate,
            dueTime: dueTime || null,
            timeZone,
            priority,
            contactMethod,
            reminderEnabled,
          })
        }
      >
        {t("people.save")}
      </button>
      <button className="btn" type="button" onClick={props.onCancel}>
        {t("people.cancel")}
      </button>
    </div>
  );
}

function InteractionEditor(props: {
  locale: Locale;
  busy: boolean;
  onSave: (
    draft: Omit<
      InteractionRecord,
      "id" | "profileId" | "personId" | "createdAt"
    >,
  ) => void;
  onCancel: () => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<InteractionRecord["kind"]>("note");
  return (
    <div className="cluster">
      <label>
        {t("people.interactionKind")}
        <select
          className="select"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value as InteractionRecord["kind"])
          }
        >
          <option value="note">{t("people.kind.note")}</option>
          <option value="contactAttempt">
            {t("people.kind.contactAttempt")}
          </option>
          <option value="conversation">{t("people.kind.conversation")}</option>
          <option value="promise">{t("people.kind.promise")}</option>
        </select>
      </label>
      <label>
        {t("people.interactionNote")}
        <textarea
          className="field"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <button
        className="btn primary"
        type="button"
        disabled={props.busy || !body.trim()}
        onClick={() =>
          props.onSave({ followUpId: null, kind, body, occurredAt: nowIso() })
        }
      >
        {t("people.save")}
      </button>
      <button className="btn" type="button" onClick={props.onCancel}>
        {t("people.cancel")}
      </button>
    </div>
  );
}

function MethodOptions(props: { t: (key: MessageKey) => string }) {
  return (
    <>
      <option value="email">{props.t("people.method.email")}</option>
      <option value="phone">{props.t("people.method.phone")}</option>
      <option value="message">{props.t("people.method.message")}</option>
      <option value="meeting">{props.t("people.method.meeting")}</option>
      <option value="other">{props.t("people.method.other")}</option>
    </>
  );
}

function FollowUpQueue(props: {
  rows: FollowUpEntry[];
  locale: Locale;
  timeZone: string;
  busy: boolean;
  onOpen: (row: FollowUpEntry) => void;
  onComplete: (row: FollowUpEntry) => void;
  onReopen: (row: FollowUpEntry) => void;
  onSnooze: (row: FollowUpEntry) => void;
  onEdit?: (row: FollowUpEntry) => void;
  onDelete?: (row: FollowUpEntry) => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  if (!props.rows.length)
    return <p className="muted">{t("people.noFollowUps")}</p>;
  const label = (state: FollowUpEntry["queueState"]) =>
    t(`people.${state === "due" ? "dueToday" : state}` as MessageKey);
  return (
    <ul className="task-list" aria-live="polite">
      {props.rows.map((row) => (
        <li key={row.id} className="task-row">
          <button
            className="task-title-link"
            type="button"
            onClick={() => props.onOpen(row)}
          >
            <bdi>{row.title}</bdi>
            <small className="muted">
              {row.person?.displayName ?? ""} ·{" "}
              {displayDate(
                row.dueDate,
                props.locale,
                row.timeZone,
                row.dueTime,
              )}
            </small>
          </button>
          <span className="muted">
            {label(row.queueState)} ·{" "}
            {t(`people.priority.${row.priority}` as MessageKey)}
          </span>
          {row.status === "open" ? (
            <>
              <button
                className="btn"
                type="button"
                disabled={props.busy}
                onClick={() => props.onComplete(row)}
              >
                {t("people.complete")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={props.busy}
                onClick={() => props.onSnooze(row)}
              >
                {t("people.snooze")}
              </button>
              {props.onEdit ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => props.onEdit?.(row)}
                >
                  {t("people.edit")}
                </button>
              ) : null}
              {props.onDelete ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => props.onDelete?.(row)}
                >
                  {t("people.delete")}
                </button>
              ) : null}
            </>
          ) : (
            <button
              className="btn"
              type="button"
              disabled={props.busy}
              onClick={() => props.onReopen(row)}
            >
              {t("people.reopen")}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
