import type { ReactNode } from "react";

/** Inline SVG icons matching Venus Concept v2 symbols. */
export function Icon(props: {
  name: IconName;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      aria-hidden={props.title ? undefined : true}
      role={props.title ? "img" : undefined}
    >
      {props.title ? <title>{props.title}</title> : null}
      {icons[props.name]}
    </svg>
  );
}

export type IconName =
  | "grid"
  | "checkCircle"
  | "note"
  | "calendar"
  | "bookmark"
  | "settings"
  | "search"
  | "plus"
  | "sun"
  | "moon"
  | "bell"
  | "sliders"
  | "chevron"
  | "play"
  | "pause"
  | "reset"
  | "lock"
  | "clock"
  | "close"
  | "orbit"
  | "plugins"
  | "arrow";

const icons: Record<IconName, ReactNode> = {
  grid: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </g>
  ),
  checkCircle: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </g>
  ),
  note: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </g>
  ),
  calendar: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </g>
  ),
  bookmark: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4z"
    />
  ),
  settings: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 3.2 10 2h4l.5 1.2 1.5.7 1.2-.5 2.8 2.8-.5 1.2.7 1.5L21 9.5v4l-1.2.5-.7 1.5.5 1.2-2.8 2.8-1.2-.5-1.5.7L14 21h-4l-.5-1.2-1.5-.7-1.2.5L4 16.8l.5-1.2-.7-1.5L2 13.5v-3l1.8-.5.7-1.5L4 7.3l2.8-2.8 1.2.5z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  search: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </g>
  ),
  plus: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 5v14M5 12h14"
    />
  ),
  sun: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </g>
  ),
  moon: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.1 15.8A8.7 8.7 0 0 1 8.2 3.9 8.7 8.7 0 1 0 20.1 15.8Z"
    />
  ),
  bell: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10ZM10 21h4"
    />
  ),
  sliders: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </g>
  ),
  chevron: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m9 6 6 6-6 6"
    />
  ),
  play: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m8 5 11 7-11 7z"
    />
  ),
  pause: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5v14M15 5v14"
    />
  ),
  reset: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 11a9 9 0 1 1 2 6M3 4v7h7"
    />
  ),
  lock: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </g>
  ),
  clock: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </g>
  ),
  close: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 5l14 14M19 5 5 19"
    />
  ),
  orbit: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3.5" />
      <ellipse
        cx="12"
        cy="12"
        rx="10"
        ry="5.5"
        transform="rotate(-35 12 12)"
      />
    </g>
  ),
  plugins: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <path d="M16 16h2v2h-2zM16 13v3M19 16h-3" />
    </g>
  ),
  arrow: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5 12h14m-6-6 6 6-6 6"
    />
  ),
};
