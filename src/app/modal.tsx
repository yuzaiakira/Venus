import { useEffect, useRef, type ReactNode } from "react";

/** Native dialog provides focus containment, Escape and focus restoration. */
export function Modal(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog native-dialog"
      aria-label={props.label}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      {props.children}
    </dialog>
  );
}
