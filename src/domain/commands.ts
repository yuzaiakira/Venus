export interface PaletteCommand {
  id: string;
  label: string;
  group: "local" | "web" | "unavailable";
  available: boolean;
  profileId: string;
}
export function filterCommands(commands: PaletteCommand[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return commands;
  return commands.filter((command) =>
    command.label.toLocaleLowerCase().includes(needle),
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
