import { Modal } from "./modal";
import { useEffect, useRef, useState } from "react";
import type { Productivity } from "../application/productivity";
import { WorkspaceError } from "../domain/dashboard";
import { documentFromPlainText } from "../domain/productivity";
import { translate, type MessageKey } from "../locales/messages";

export function CaptureDialog(props: {
  locale: "en" | "fa";
  kind: "note" | "task" | "event";
  productivity: Productivity;
  taskToday?: boolean;
  onCreateEvent?: (title: string, details: string) => Promise<void>;
  onClose: () => void;
  onKind: (kind: "note" | "task" | "event") => void;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [eventDraft, setEventDraft] = useState("");
  const closeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  async function save() {
    if (status === "saving") return;
    setStatus("saving");
    try {
      if (props.kind === "event") {
        if (!props.onCreateEvent || !title.trim())
          throw new Error("invalidInput");
        await props.onCreateEvent(title, details);
        setEventDraft("");
        setStatus("saved");
        setTitle("");
        setDetails("");
        closeTimer.current = window.setTimeout(() => props.onClose(), 450);
        return;
      }
      if (!title.trim()) throw new WorkspaceError("invalidInput");
      if (props.kind === "note") {
        await props.productivity.createNote({
          title,
          body: documentFromPlainText(details),
          folderId: null,
        });
      } else {
        await props.productivity.createTask(
          title,
          details,
          props.taskToday ?? false,
        );
      }
      setStatus("saved");
      setTitle("");
      setDetails("");
      closeTimer.current = window.setTimeout(() => props.onClose(), 450);
    } catch {
      setStatus("error");
    }
  }
  return (
    <Modal label={t("nav.capture")} onClose={props.onClose}>
      <p>{t("capture.note")}</p>
      <div className="cluster">
        {(
          [
            ["note", "capture.noteKind"],
            ["task", "capture.task"],
            ["event", "capture.event"],
          ] as const
        ).map(([kind, key]) => (
          <button
            key={kind}
            className="btn"
            type="button"
            aria-pressed={props.kind === kind}
            onClick={() => props.onKind(kind)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <label>
        {t("capture.title")}
        <input
          autoFocus
          className="field"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        {t("capture.details")}
        <textarea
          className="field"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </label>
      <p role="status">
        {status === "saved"
          ? t("capture.saved")
          : status === "error"
            ? t("capture.failed")
            : status === "saving"
              ? t("notes.saving")
              : ""}
      </p>
      {props.kind === "event" && eventDraft ? (
        <p>
          <bdi>{eventDraft}</bdi>
        </p>
      ) : null}
      <div className="dialog-actions">
        <button
          className="btn primary"
          type="button"
          disabled={status === "saving"}
          onClick={() => void save()}
        >
          {t("capture.save")}
        </button>
        <button className="btn" type="button" onClick={props.onClose}>
          {t("dialog.close")}
        </button>
      </div>
    </Modal>
  );
}
