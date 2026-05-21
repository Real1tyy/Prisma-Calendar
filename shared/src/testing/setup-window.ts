// Production code uses `window.setTimeout` / `window.setInterval` (per the
// obsidianmd/prefer-window-timers ESLint rule). The Obsidian renderer always
// provides `window`, but vitest's `node` test environment doesn't — alias
// `window` to `globalThis` so timer calls resolve in tests too. Importing this
// file for its side effect installs the shim once per test process.
// Test-only shim: `globalThis` is the only reference that works in BOTH the
// node environment (window is undefined) and jsdom (window already wired).
// `obsidianmd/no-global-this` is disabled for this file via eslint.config.js.
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
	(globalThis as { window: typeof globalThis }).window = globalThis;
}
