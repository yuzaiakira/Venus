import {
  contrastRatio,
  directionFor,
  glassSolid,
  resolveTheme,
  themeTokens,
  type Bootstrap,
  type ThemeMode,
  type Wallpaper,
} from "../domain/dashboard";

export function applyDocument(input: {
  bootstrap: Bootstrap;
  themeMode: ThemeMode;
  wallpaper: Wallpaper;
  blurPx: number;
  glassAlpha: number;
  accent: string;
  prefersDark: boolean;
  reducedMotion: boolean;
}) {
  const theme = resolveTheme(input.themeMode, input.prefersDark);
  const tokens = themeTokens[theme];
  const root = document.documentElement;
  root.lang = input.bootstrap.locale;
  root.dir = directionFor(input.bootstrap.locale);
  root.dataset.theme = input.themeMode === "system" ? "system" : theme;
  root.dataset.density = input.bootstrap.density;
  const motion =
    input.bootstrap.motion === "system"
      ? input.reducedMotion
        ? "off"
        : "system"
      : input.bootstrap.motion;
  root.dataset.motion = motion;
  const solid = glassSolid(theme, input.glassAlpha);
  const accentOk =
    contrastRatio(input.accent, tokens.canvas) >= 3
      ? input.accent
      : tokens.focus;
  const style = root.style;
  style.setProperty("--canvas", tokens.canvas);
  style.setProperty("--surface", tokens.surface);
  style.setProperty("--text", tokens.text);
  style.setProperty("--muted", tokens.muted);
  style.setProperty("--border", tokens.border);
  style.setProperty("--focus", tokens.focus);
  style.setProperty("--error", tokens.error);
  style.setProperty("--success", tokens.success);
  style.setProperty("--accent", accentOk);
  style.setProperty("--glass", solid);
  style.setProperty("--blur", `${input.blurPx}px`);
  style.setProperty("--font-scale", String(input.bootstrap.fontScale));
  document.body.dataset.scene =
    input.wallpaper.kind === "scene" ? input.wallpaper.sceneId : "";
  if (input.wallpaper.kind === "gradient") {
    document.body.style.background = `linear-gradient(${input.wallpaper.angle}deg, ${input.wallpaper.from}, ${input.wallpaper.to})`;
  } else if (input.wallpaper.kind !== "upload") {
    document.body.style.removeProperty("background");
    document.body.style.removeProperty("background-image");
  }
}

export function paintUploadedWallpaper(asset: {
  mime: string;
  bytes: Uint8Array;
}) {
  const url = URL.createObjectURL(
    new Blob([asset.bytes], { type: asset.mime }),
  );
  document.body.style.backgroundImage = `url("${url}")`;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  return () => URL.revokeObjectURL(url);
}
