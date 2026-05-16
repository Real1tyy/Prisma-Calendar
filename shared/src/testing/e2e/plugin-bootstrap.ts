import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ConsoleMessage, Page } from "@playwright/test";

import { createFileLogger, isTransientObsidianTeardownError, type Logger, type ObsidianVersion } from "./bootstrap";
import { pruneStaleE2eResources } from "./global-setup";

// Plugin-e2e fixtures share ~70 lines of identical boilerplate per producer
// plugin: cache/vaults/logs path conventions, file-logger setup, stale-vault
// prune, renderer-ready hooks (E2E flag + drop Notification + neutralise the
// notice container + silence console.log/info/debug), the `.obsidian/app.json`
// suppression write, and the console.error / pageerror guard around every
// spec body. This module factors them out so adding the third producer is a
// few lines of glue, not a copy-paste of Prisma-Calendar's fixture.
//
// Plugin-specific behaviour (Prisma's demo mode, calendar-bundle waits, DSL
// fixture variants; NotesManipulator's Pro-flip + apiManager.expose) still
// lives in each plugin's electron.ts — the factory only handles the parts
// that are genuinely the same shape across producers.

export interface PluginE2eHarnessOptions {
	/** Absolute path to the plugin's `e2e/` directory. */
	e2eRoot: string;
}

export interface PluginE2eHarness {
	/** Per-run cache root, `<e2eRoot>/.cache`. */
	readonly cacheRoot: string;
	/** Vault dirs go under here, one per run. */
	readonly vaultsRoot: string;
	/** Single rolling log file every bootstrap appends to. */
	readonly logFile: string;
	/** Pinned Obsidian version JSON (`appVersion`, `installerVersion`). */
	readonly versionFile: string;
	/** Vault skeleton copied verbatim into every per-run vault. */
	readonly vaultSeedDir: string;
	/** True when E2E_VERBOSE=1 or E2E_DEBUG=1 — controls log noise. */
	readonly verbose: boolean;
	/** File logger writing to `logFile`. */
	readonly log: Logger;
	/** Read and parse the pinned Obsidian version. */
	readVersion(): ObsidianVersion;
}

/**
 * Set up the standard plugin-e2e directory conventions + side-effects.
 *
 * Call once at the top of each plugin's `e2e/fixtures/electron.ts`. It
 * computes the canonical cache/vaults/log/version/seed paths under
 * `e2eRoot`, opens a file logger, and prunes stale vault dirs left by
 * previous runs. The returned harness is the "props" every other helper in
 * this module needs.
 */
export function createPluginE2eHarness(options: PluginE2eHarnessOptions): PluginE2eHarness {
	const cacheRoot = join(options.e2eRoot, ".cache");
	const vaultsRoot = join(cacheRoot, "vaults");
	const logFile = join(cacheRoot, "last-run.log");
	const versionFile = join(options.e2eRoot, "obsidian-version.json");
	const vaultSeedDir = join(options.e2eRoot, "fixtures", "vault-seed");
	const verbose = process.env["E2E_VERBOSE"] === "1" || process.env["E2E_DEBUG"] === "1";
	const log = createFileLogger(logFile, { verbose });

	pruneStaleE2eResources({ vaultsRoot });

	return {
		cacheRoot,
		vaultsRoot,
		logFile,
		versionFile,
		vaultSeedDir,
		verbose,
		log,
		readVersion() {
			return JSON.parse(readFileSync(versionFile, "utf8")) as ObsidianVersion;
		},
	};
}

/**
 * Apply the renderer-side hooks every plugin-e2e fixture wants on every
 * boot. Call this from your `onRendererReady` hook before any plugin-
 * specific renderer setup; compose with extra `page.evaluate` blocks if you
 * need more.
 *
 * Four things happen, in order:
 *   1. `window.E2E = true` so plugin code can branch on it (e.g. expose
 *      testability seams that production builds hide).
 *   2. `delete window.Notification` — the Web Notifications API. The
 *      notification managers in our plugins guard every system-tray call
 *      with `"Notification" in window`, so dropping it short-circuits the
 *      whole feature. Without this, every spec that ingests a near-now
 *      event pings the host OS tray — an audible nuisance on dev laptops.
 *   3. A CSS rule on `.notice-container, .notice-container .notice`
 *      removes pointer events. Obsidian's success/error toasts stack
 *      top-right and steal clicks for several seconds. Specs assert on
 *      disk/state, not toast text, so blocking pointer-events on the
 *      whole container lets every spec skip the "wait for notices to
 *      drain" step. Notices still render visibly in headed runs.
 *   4. When `verbose` is false, replace `console.log` / `info` / `debug`
 *      with no-ops so plugin logging doesn't drown Playwright's summary.
 *      `console.warn` and `console.error` stay live so the console-error
 *      guard sees real failures.
 */
export async function applyStandardRendererBoilerplate(page: Page, options: { verbose: boolean }): Promise<void> {
	await page.evaluate(
		({ verbose }) => {
			const w = window as unknown as { E2E?: boolean; Notification?: unknown };
			w.E2E = true;
			delete w.Notification;
			// eslint-disable-next-line obsidianmd/no-forbidden-elements
			const style = document.createElement("style");
			style.textContent = ".notice-container, .notice-container .notice { pointer-events: none !important; }";
			document.head.appendChild(style);
			if (verbose) return;
			const noop = (): void => {};
			console.log = noop;

			console.info = noop;

			console.debug = noop;
		},
		{ verbose: options.verbose }
	);
}

/**
 * Write `.obsidian/app.json` with the testing-friendly defaults every
 * producer fixture wants:
 *   - `alwaysUpdateLinks: true` skips the "Update links" modal that fires
 *     whenever the plugin renames a file (zettel id assignment, title
 *     change, file-rename presets). That modal blocks every subsequent
 *     click in the spec.
 *   - `promptDelete: false` skips the file-deletion confirmation that
 *     would otherwise hang `vault.delete` calls.
 *
 * Call this inside your `seedPluginData` hook. `pluginDir` is the absolute
 * path to `<vault>/.obsidian/plugins/<id>/` as the shared bootstrap passes
 * it; the `.obsidian/` directory is two levels up.
 */
export function writeStandardAppJson(pluginDir: string): void {
	const obsidianDir = join(pluginDir, "..", "..");
	writeFileSync(
		join(obsidianDir, "app.json"),
		JSON.stringify({ alwaysUpdateLinks: true, promptDelete: false }, null, 2),
		"utf8"
	);
}

const TRANSIENT_OBSIDIAN_JSON_PATHS = [
	".obsidian/app.json",
	".obsidian/community-plugins.json",
	".obsidian/appearance.json",
] as const;

/**
 * `page.reload()` (and the initial workspace flush during bootstrap) races
 * with Obsidian's own writers for `.obsidian/*.json`. The renderer
 * occasionally reads a file mid-rewrite and logs
 * `failed to read JSON .obsidian/app.json SyntaxError: Unexpected end of
 * JSON input`. Obsidian recovers by falling back to defaults and plugin
 * state is unaffected, so this is not a plugin bug — filter it out.
 */
function isTransientObsidianJsonReadError(text: string): boolean {
	if (!text.includes("failed to read JSON")) return false;
	return TRANSIENT_OBSIDIAN_JSON_PATHS.some((p) => text.includes(p));
}

export interface ConsoleErrorGuardOptions {
	/**
	 * Plugin-specific transient patterns. Use for races the plugin author
	 * has analysed and accepts (e.g. ENOENT on a freshly-deleted file the
	 * metadata cache still had pending). Matched against both
	 * `console.error` text and `pageerror` messages.
	 */
	extraTransientPatterns?: readonly RegExp[];
	/**
	 * Spec-level expected errors. Use for resilience suites that
	 * deliberately induce broken state (corrupt data.json, EACCES file
	 * reads, ICS subscription failures). Same matching rules as
	 * `extraTransientPatterns`.
	 */
	expectedErrorPatterns?: readonly RegExp[];
}

export interface ConsoleErrorGuard {
	/** Subscribe both `console` and `pageerror` listeners. */
	attach(page: Page): void;
	/** Remove both listeners. Safe to call multiple times. */
	detach(page: Page): void;
	/** Throw if any non-allowlisted error was seen. */
	throwIfErrors(): void;
}

/**
 * Builds a `console.error` + `pageerror` guard preconfigured with the
 * always-allowed transient patterns (Obsidian mid-rewrite JSON reads,
 * teardown-time `_workspaceLeaves` races). Plugins layer on their own
 * transient patterns and any spec-level expected-error patterns.
 *
 * Typical usage inside a Playwright fixture:
 *
 *   const guard = createConsoleErrorGuard({ ... });
 *   guard.attach(handle.page);
 *   try {
 *     await use(handle);
 *   } finally {
 *     guard.detach(handle.page);
 *     await handle.close();
 *   }
 *   guard.throwIfErrors();  // surface accumulated errors as spec failure
 */
export function createConsoleErrorGuard(options: ConsoleErrorGuardOptions = {}): ConsoleErrorGuard {
	const consoleErrors: string[] = [];
	const isAllowed = (text: string): boolean => {
		if (isTransientObsidianJsonReadError(text)) return true;
		if (isTransientObsidianTeardownError(text)) return true;
		if (options.extraTransientPatterns?.some((re) => re.test(text))) return true;
		if (options.expectedErrorPatterns?.some((re) => re.test(text))) return true;
		return false;
	};

	const onConsole = (msg: ConsoleMessage): void => {
		if (msg.type() !== "error") return;
		const text = msg.text();
		if (isAllowed(text)) return;
		consoleErrors.push(text);
	};
	const onPageError = (err: Error): void => {
		if (isAllowed(err.message)) return;
		consoleErrors.push(`pageerror: ${err.message}`);
	};

	return {
		attach(page) {
			page.on("console", onConsole);
			page.on("pageerror", onPageError);
		},
		detach(page) {
			page.off("console", onConsole);
			page.off("pageerror", onPageError);
		},
		throwIfErrors() {
			if (consoleErrors.length > 0) {
				throw new Error(`renderer emitted ${consoleErrors.length} error(s):\n${consoleErrors.join("\n")}`);
			}
		},
	};
}
