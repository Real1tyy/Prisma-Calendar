// Production code uses `window.setTimeout` / `window.setInterval` (per the
// obsidianmd/prefer-window-timers ESLint rule). The Obsidian renderer always
// provides `window`, but vitest's `node` test environment doesn't — alias
// `window` to `globalThis` so timer calls resolve in tests too. Importing this
// file for its side effect installs the shim once per test process.
if (typeof globalThis.window === "undefined") {
	(globalThis as { window: typeof globalThis }).window = globalThis;
}
