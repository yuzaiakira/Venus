import {
  searchFold,
  searchLibrary,
  type NoteRecord,
  type TaskRecord,
  type LocalBookmarkRecord,
} from "./productivity";
export interface PaletteCommand {
  id: string;
  label: string;
  group: "local" | "web" | "unavailable";
  available: boolean;
  profileId: string;
}
export function filterCommands(commands: PaletteCommand[], query: string) {
  const needle = searchFold(query.trim());
  if (!needle) return commands;
  return commands.filter((command) =>
    searchFold(command.label).includes(needle),
  );
}
export type PermissionOutcome =
  | "granted"
  | "denied"
  | "dismissed"
  | "failed"
  | "unsupported"
  | "unresolved";

export function permissionNoteKey(outcome: PermissionOutcome) {
  if (outcome === "granted") return "onboarding.granted" as const;
  if (outcome === "denied") return "onboarding.denied" as const;
  if (outcome === "dismissed") return "onboarding.dismissed" as const;
  if (outcome === "failed") return "onboarding.failed" as const;
  if (outcome === "unsupported") return "onboarding.unsupported" as const;
  return "onboarding.unresolved" as const;
}

export function onboardingContinues(granted: boolean) {
  void granted;
  return true;
}

/** Command search and content search share the same authoritative library. */
export function searchPalette(
  commands: PaletteCommand[],
  library: {
    notes: NoteRecord[];
    tasks: TaskRecord[];
    bookmarks: LocalBookmarkRecord[];
  },
  query: string,
) {
  const filtered = filterCommands(commands, query);
  if (!query.trim()) return filtered;
  const hits = searchLibrary({ ...library, commands: [] }, query)
    .slice(0, 30)
    .map(
      (hit): PaletteCommand => ({
        id: `open-${hit.kind}:${hit.id}`,
        label: hit.title,
        group: "local",
        available: true,
        profileId: "",
      }),
    );
  const web = commands.find((command) => command.id === "web");
  return [
    ...hits,
    ...filtered,
    ...(web && !filtered.some((command) => command.id === "web") ? [web] : []),
  ];
}
