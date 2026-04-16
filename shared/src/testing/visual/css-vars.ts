/**
 * Obsidian CSS custom property fixtures for visual testing.
 *
 * Plugin styles reference variables like `--background-primary`, `--text-normal`,
 * `--interactive-accent` etc. that Obsidian injects at runtime. In a bare browser
 * we have to provide them explicitly. Values taken from Obsidian's default theme.
 *
 * Only "theme" values should differ between LIGHT and DARK. Layout/typography
 * variables are shared in COMMON.
 */

const COMMON = `
  --font-ui-smaller: 12px;
  --font-ui-small: 13px;
  --font-ui-medium: 14px;
  --font-ui-large: 16px;
  --font-text-size: 16px;
  --font-monospace-default: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --font-interface-override: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, sans-serif;
  --line-height-normal: 1.5;
  --line-height-tight: 1.3;

  --size-2-1: 2px;
  --size-2-2: 4px;
  --size-2-3: 6px;
  --size-4-1: 4px;
  --size-4-2: 8px;
  --size-4-3: 12px;
  --size-4-4: 16px;
  --size-4-6: 24px;
  --size-4-8: 32px;

  --radius-s: 4px;
  --radius-m: 8px;
  --radius-l: 12px;

  --input-height: 30px;
`;

const LIGHT = `
:root {
  color-scheme: light;
  ${COMMON}

  --background-primary: #ffffff;
  --background-primary-alt: #fafafa;
  --background-secondary: #f2f3f5;
  --background-secondary-alt: #e3e5e8;
  --background-modifier-border: #dcddde;
  --background-modifier-border-hover: #b8bac0;
  --background-modifier-hover: rgba(0, 0, 0, 0.075);
  --background-modifier-active-hover: rgba(0, 0, 0, 0.125);
  --background-modifier-success: #28a745;
  --background-modifier-error: #e75150;

  --text-normal: #222426;
  --text-muted: #6e7681;
  --text-faint: #9ca3af;
  --text-on-accent: #ffffff;
  --text-accent: #705dcf;
  --text-error: #e75150;
  --text-success: #28a745;

  --interactive-normal: #f2f3f5;
  --interactive-hover: #e4e6ea;
  --interactive-accent: #705dcf;
  --interactive-accent-hover: #8171da;

  --tag-background: rgba(112, 93, 207, 0.1);
  --tag-color: #705dcf;
}

body {
  font-family: var(--font-interface-override);
  font-size: var(--font-text-size);
  color: var(--text-normal);
  background: var(--background-primary);
  margin: 0;
  padding: 16px;
}
`;

const DARK = `
:root {
  color-scheme: dark;
  ${COMMON}

  --background-primary: #1e1e1e;
  --background-primary-alt: #1a1a1a;
  --background-secondary: #252525;
  --background-secondary-alt: #2d2d2d;
  --background-modifier-border: #3a3a3a;
  --background-modifier-border-hover: #4e4e4e;
  --background-modifier-hover: rgba(255, 255, 255, 0.075);
  --background-modifier-active-hover: rgba(255, 255, 255, 0.125);
  --background-modifier-success: #2ea043;
  --background-modifier-error: #e75150;

  --text-normal: #dcddde;
  --text-muted: #9a9a9a;
  --text-faint: #6e7681;
  --text-on-accent: #ffffff;
  --text-accent: #a88df0;
  --text-error: #e75150;
  --text-success: #2ea043;

  --interactive-normal: #2a2a2a;
  --interactive-hover: #363636;
  --interactive-accent: #8171da;
  --interactive-accent-hover: #9588e4;

  --tag-background: rgba(129, 113, 218, 0.2);
  --tag-color: #a88df0;
}

body {
  font-family: var(--font-interface-override);
  font-size: var(--font-text-size);
  color: var(--text-normal);
  background: var(--background-primary);
  margin: 0;
  padding: 16px;
}
`;

export type ObsidianTheme = "light" | "dark";

export const OBSIDIAN_THEMES: readonly ObsidianTheme[] = ["light", "dark"] as const;

export function obsidianCssVars(theme: ObsidianTheme): string {
	return theme === "dark" ? DARK : LIGHT;
}
