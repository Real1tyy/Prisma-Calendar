import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Browser, chromium, type Page } from "@playwright/test";

// Generic Obsidian E2E bootstrap — spawns a real Obsidian Electron instance per
// test, connects Playwright over CDP, and drives the plugin registry to a known
// state. Plugin-specific setup (seeding data.json, waiting for runtime structures
// to populate) is passed in via hooks.
//
// ── Why spawn + CDP instead of `_electron.launch`? ────────────────────────────
// `_electron.launch({ executablePath: obsidian-installer })` hangs indefinitely
// (~120s) waiting for a handshake the installer never emits — the packaged
// Obsidian binary silently ignores Playwright's electron launch dance. Using
// the standalone `electron` npm package as the runtime fails differently:
// main.js runs but never creates a BrowserWindow (confirmed via CDP).
// Workaround: spawn the installer ourselves with `--remote-debugging-port=<port>`
// (the installer IS the Electron runtime Obsidian was built with, and it does
// honour Chromium's CDP flag), grep the "DevTools listening on ws://..." line
// from stderr, and attach Playwright via `chromium.connectOverCDP`. This skips
// Playwright's electron launch machinery entirely but still gives us full
// Page/Browser access.
//
// ── Why isolate XDG_RUNTIME_DIR? ──────────────────────────────────────────────
// Obsidian checks `$XDG_RUNTIME_DIR/.obsidian-cli.sock` at startup. If the
// developer has Obsidian running on their desktop, the spawned instance detects
// that socket and silently drops into headless CLI mode — no BrowserWindow is
// ever created, no plugin loads, the process just exits with code 0 making it
// look like Obsidian launched and quit instantly. Giving each run its own
// short `/tmp/...` XDG dir prevents the collision. The path must be *short*:
// Unix socket paths are capped at 108 bytes and Obsidian creates additional
// sockets (wayland-0, etc.) under this dir, so paths like the vault's full
// absolute path will silently truncate and fail.
//
// ── Why --disable-gpu / --disable-software-rasterizer on Linux? ──────────────
// Under xvfb (the default for headless CI) there's no real GPU; Chromium's
// hardware accel path errors out and can stall the CDP handshake indefinitely.
// Forcing the software path is reliable across headless and headed runs.
//
// ── Why programmatic plugin enable instead of clicking the trust dialog? ─────
// Community plugins start disabled on a fresh vault until the user clicks
// "Trust author and enable plugins". The dialog's DOM is fragile (different
// layouts across Obsidian versions, can race with the window paint). We bypass
// it entirely by calling `app.plugins.setEnable(true)` + `enablePluginAndSave(id)`
// from the renderer — this is what the dialog ultimately does anyway.

export type LogLevel = "info" | "debug";

export type Logger = {
	info: (msg: string) => void;
	debug: (msg: string) => void;
};

export type CreateFileLoggerOptions = {
	/** When true, debug-level messages are emitted. Defaults to E2E_VERBOSE=1. */
	verbose?: boolean;
};

export type PluginArtifact = {
	/** Vault-relative plugin folder (e.g. "prisma-calendar"). */
	id: string;
	/** Absolute path to the plugin source root (folder containing main.js/manifest.json/styles.css). */
	rootDir: string;
	/** Files to copy from rootDir into the staged plugin folder. Defaults to main.js, manifest.json, styles.css. */
	files?: readonly string[];
};

export type ObsidianVersion = {
	appVersion: string;
	installerVersion: string;
};

export type BootstrapOptions = {
	/** Pinned Obsidian version (consumed by obsidian-launcher). */
	version: ObsidianVersion;
	/** Directory to copy as the starter vault (must contain .obsidian/community-plugins.json). */
	vaultSeedDir: string;
	/** Plugin artifacts to stage into `.obsidian/plugins/<id>/` in the fresh vault. */
	plugin: PluginArtifact;
	/** Directory to hold per-run vault copies. Defaults to `<os-tmp>/obsidian-e2e-vaults`. */
	vaultsRoot?: string;
	/** Short tag included in the vault directory name for debugging. */
	prefix?: string;
	/** CDP port for the spawned Obsidian. Default 9222. */
	cdpPort?: number;
	/** Additional env-vars passed to the spawned Obsidian process. */
	env?: Record<string, string>;
	/** Additional CLI args appended after the defaults. */
	extraArgs?: readonly string[];
	/**
	 * Hook invoked after the plugin files are staged; use this to write
	 * `data.json` into the plugin folder. Typical use: pre-seed settings AND
	 * set `version: manifest.version` to suppress the plugin's "What's new"
	 * modal on first boot (most plugins trigger it when the stored version
	 * differs from the manifest, and a fresh vault has no stored version).
	 */
	seedPluginData?: (pluginDir: string, ctx: { manifest: Record<string, unknown> }) => void | Promise<void>;
	/** Hook invoked once `window.app` is available; use this to force-enable the plugin when needed. */
	onRendererReady?: (page: Page) => void | Promise<void>;
	/** Hook invoked after the plugin is loaded; use this to wait for plugin-specific runtime structures. */
	afterPluginLoaded?: (page: Page) => void | Promise<void>;
	/** Optional sink for progress/debug lines. Defaults to a no-op. */
	logger?: Logger;
};

export type BootstrappedObsidian = {
	browser: Browser;
	page: Page;
	process: ChildProcess;
	vaultDir: string;
	userDataDir: string;
	readVaultFile: (relativePath: string) => string;
	close: () => Promise<void>;
};

const DEFAULT_PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"] as const;

export function createFileLogger(logFile: string, options: CreateFileLoggerOptions = {}): Logger {
	mkdirSync(join(logFile, ".."), { recursive: true });
	const verbose = options.verbose ?? process.env["E2E_VERBOSE"] === "1";
	const write = (level: LogLevel, msg: string): void => {
		const line = `[e2e ${new Date().toISOString().slice(11, 23)}] ${msg}\n`;
		// Always append to the log file so post-mortem has full detail; stderr
		// respects the verbose flag so `pnpm test:e2e` stays legible.
		try {
			appendFileSync(logFile, line, "utf8");
		} catch {
			// logging is best-effort; never fail a test because logging broke.
		}
		if (level === "info" || verbose) {
			process.stderr.write(line);
		}
	};
	return {
		info: (msg) => write("info", msg),
		debug: (msg) => write("debug", msg),
	};
}

const NOOP_LOGGER: Logger = { info: () => {}, debug: () => {} };

export async function bootstrapObsidian(options: BootstrapOptions): Promise<BootstrappedObsidian> {
	const log = options.logger ?? NOOP_LOGGER;
	const vaultsRoot = options.vaultsRoot ?? join(tmpdir(), "obsidian-e2e-vaults");
	const cdpPort = options.cdpPort ?? 9222;
	// Vault dir name is `YYYY-MM-DD-HHmm-<prefix>-<uuid8>` so `ls -lt` shows runs
	// chronologically and the cleanup task (mise run test-e2e-clean) can parse
	// the date prefix to decide what's stale. The uuid segment keeps runs from
	// the same minute collision-free and is what XDG uses below — we need a
	// short stable id for the /tmp socket dir (108-byte socket path cap).
	const uuid = randomUUID().slice(0, 8);
	const timestamp = formatRunTimestamp(new Date());
	const id = `${timestamp}-${options.prefix ?? "run"}-${uuid}`;
	log.info(`bootstrap start id=${id}`);

	mkdirSync(vaultsRoot, { recursive: true });
	const vaultDir = join(vaultsRoot, id, "vault");
	mkdirSync(vaultDir, { recursive: true });
	log.debug(`vaultDir=${vaultDir}`);

	cpSync(options.vaultSeedDir, vaultDir, { recursive: true });
	log.debug(`seed vault copied from ${options.vaultSeedDir}`);

	const pluginDir = join(vaultDir, ".obsidian", "plugins", options.plugin.id);
	mkdirSync(pluginDir, { recursive: true });
	const files = options.plugin.files ?? DEFAULT_PLUGIN_FILES;
	for (const file of files) {
		const src = join(options.plugin.rootDir, file);
		if (!existsSync(src)) {
			throw new Error(`plugin artifact missing: ${src} (run your build before tests)`);
		}
		cpSync(src, join(pluginDir, file));
	}
	log.debug(`plugin artifacts staged at ${pluginDir}`);

	const manifestPath = join(options.plugin.rootDir, "manifest.json");
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
	if (options.seedPluginData) {
		await options.seedPluginData(pluginDir, { manifest });
		log.debug(`plugin data seeded`);
	}

	// obsidian-launcher's setupConfigDir writes the obsidian.json that registers
	// our vault with open:true, sets the localStorage key that disables Safe
	// Mode for this vaultId, writes Preferences, and copies the asar in — it's
	// the sanctioned way to produce a userDataDir Obsidian will happily boot
	// against. The returned installerPath is the Electron binary we spawn below.
	const { userDataDir, installerPath } = await buildUserDataDir(vaultDir, options.version);
	log.debug(`userDataDir=${userDataDir}`);
	log.debug(`installerPath=${installerPath}`);

	const sandboxArgs = process.platform === "linux" ? ["--no-sandbox"] : [];
	const gpuArgs = process.platform === "linux" ? ["--disable-gpu", "--disable-software-rasterizer"] : [];
	// Must be a *short* path — see the XDG_RUNTIME_DIR note at the top of this
	// file. Uuid8 keeps us well under the 108-byte socket limit regardless of
	// how long the timestamped vault id grows.
	const xdgRuntimeDir = `/tmp/o-e2e-${uuid}`;
	mkdirSync(xdgRuntimeDir, { recursive: true, mode: 0o700 });
	log.debug(`XDG_RUNTIME_DIR=${xdgRuntimeDir}`);

	const binary = process.env["OBSIDIAN_BIN"] ?? installerPath;
	const spawnArgs = [
		...sandboxArgs,
		...gpuArgs,
		`--remote-debugging-port=${cdpPort}`,
		`--user-data-dir=${userDataDir}`,
		...(options.extraArgs ?? []),
	];
	log.debug(`spawning ${binary} ${spawnArgs.join(" ")}`);
	const proc = spawn(binary, spawnArgs, {
		env: {
			...process.env,
			XDG_RUNTIME_DIR: xdgRuntimeDir,
			...options.env,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});
	log.debug(`spawned pid=${proc.pid}`);
	proc.stdout?.on("data", (d) => log.debug(`obsidian.stdout: ${String(d).trimEnd()}`));
	proc.on("exit", (code, signal) => log.debug(`obsidian process exit code=${code} signal=${signal}`));

	// Grep the CDP endpoint out of Obsidian's own stderr. Chromium prints
	// "DevTools listening on ws://..." as soon as the debug port is up; this
	// is the one signal we can rely on cross-version without touching
	// Playwright's _electron machinery.
	const wsEndpoint = await new Promise<string>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("timeout waiting for DevTools WebSocket URL from Obsidian stderr")),
			60_000
		);
		let buffer = "";
		proc.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			log.debug(`obsidian.stderr: ${text.trimEnd()}`);
			buffer += text;
			const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
			if (match) {
				clearTimeout(timer);
				resolve(match[1]!);
			}
		});
		proc.on("exit", () => {
			clearTimeout(timer);
			reject(new Error("Obsidian process exited before DevTools WebSocket came up"));
		});
	});
	log.debug(`got CDP wsEndpoint=${wsEndpoint}`);

	const browser = await chromium.connectOverCDP(wsEndpoint, { timeout: 30_000 });
	log.debug(`connected (contexts=${browser.contexts().length})`);

	const context = browser.contexts()[0];
	if (!context) throw new Error("no browser context after connect");

	// Poll context.pages() directly instead of `browser.firstWindow()` —
	// firstWindow() hangs against Obsidian (never resolves) because of how the
	// renderer window is attached after the CDP connection is already up. The
	// last page in the list is the workspace window; earlier entries can be
	// transient splash/dev pages.
	let page: Page | undefined;
	const pageDeadline = Date.now() + 120_000;
	while (Date.now() < pageDeadline) {
		const pages = context.pages();
		if (pages.length > 0) {
			page = pages[pages.length - 1]!;
			log.debug(`found ${pages.length} page(s); using last: url=${page.url()}`);
			break;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	if (!page) throw new Error("no Obsidian renderer page appeared within 120s");

	pipeRendererConsole(page, log);

	await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch((err) => {
		log.debug(`domcontentloaded timeout — continuing: ${String(err)}`);
	});

	log.debug(`waiting for window.app...`);
	await page.waitForFunction(() => Boolean((window as unknown as { app?: unknown }).app), null, {
		timeout: 60_000,
	});
	log.debug(`window.app exists`);

	if (options.onRendererReady) {
		await options.onRendererReady(page);
	}

	await ensurePluginLoaded(page, options.plugin.id, log);

	if (options.afterPluginLoaded) {
		await options.afterPluginLoaded(page);
	}

	log.info(`bootstrap ready id=${id} plugin=${options.plugin.id}`);

	return {
		browser,
		page,
		process: proc,
		vaultDir,
		userDataDir,
		readVaultFile: (relativePath: string) => readFileSync(join(vaultDir, relativePath), "utf8"),
		close: async () => {
			log.debug(`closing obsidian (${id})`);
			await browser.close().catch((err) => log.debug(`browser close error: ${String(err)}`));
			if (!proc.killed) {
				proc.kill("SIGTERM");
				await new Promise<void>((resolve) => {
					const t = setTimeout(() => {
						if (!proc.killed) proc.kill("SIGKILL");
						resolve();
					}, 5_000);
					proc.on("exit", () => {
						clearTimeout(t);
						resolve();
					});
				});
			}
			if (process.env["E2E_CLEANUP"] === "1") {
				rmSync(join(vaultsRoot, id), { recursive: true, force: true });
				log.debug(`vault cleaned`);
			} else {
				log.debug(`vault kept at ${join(vaultsRoot, id)} (set E2E_CLEANUP=1 to delete)`);
			}
		},
	};
}

async function buildUserDataDir(
	vaultDir: string,
	version: ObsidianVersion
): Promise<{ userDataDir: string; installerPath: string }> {
	const launcherModule = await import("obsidian-launcher");
	const Launcher = (launcherModule as { default: new () => ObsidianLauncherLike }).default;
	const launcher = new Launcher();
	const [appPath, installerPath] = await Promise.all([
		launcher.downloadApp(version.appVersion),
		launcher.downloadInstaller(version.installerVersion),
	]);
	const userDataDir = await launcher.setupConfigDir({
		appVersion: version.appVersion,
		installerVersion: version.installerVersion,
		appPath,
		vault: vaultDir,
	});
	return { userDataDir, installerPath };
}

type ObsidianLauncherLike = {
	downloadApp: (version: string) => Promise<string>;
	downloadInstaller: (version: string) => Promise<string>;
	setupConfigDir: (opts: {
		appVersion: string;
		installerVersion: string;
		appPath: string;
		vault: string;
	}) => Promise<string>;
};

async function ensurePluginLoaded(page: Page, pluginId: string, log: Logger, timeoutMs = 60_000): Promise<void> {
	log.debug(`ensurePluginLoaded: waiting for app.plugins...`);
	await page.waitForFunction(() => Boolean((window as unknown as { app?: { plugins?: unknown } }).app?.plugins), null, {
		timeout: timeoutMs,
	});

	const trace = await page.evaluate(async (id) => {
		const w = window as unknown as {
			app: {
				plugins: {
					setEnable?: (enable: boolean) => Promise<void> | void;
					enablePluginAndSave?: (id: string) => Promise<void>;
					enablePlugin?: (id: string) => Promise<void>;
					plugins: Record<string, unknown>;
					manifests?: Record<string, unknown>;
					loadManifests?: () => Promise<void>;
				};
			};
		};
		const plugins = w.app.plugins;
		const steps: string[] = [];
		const call = async (label: string, fn: () => Promise<unknown> | unknown): Promise<void> => {
			try {
				await fn();
				steps.push(`${label}: ok`);
			} catch (err) {
				steps.push(`${label}: FAIL ${err instanceof Error ? err.message : String(err)}`);
			}
		};
		// Order matters: setEnable(true) flips the "community plugins allowed"
		// switch (same as clicking the trust dialog), loadManifests() populates
		// the manifests registry from disk, and enablePluginAndSave() loads the
		// plugin module AND persists the change to community-plugins.json so a
		// subsequent reload within the same vault keeps it enabled.
		if (typeof plugins.setEnable === "function") await call("setEnable(true)", () => plugins.setEnable!(true));
		if (typeof plugins.loadManifests === "function") await call("loadManifests()", () => plugins.loadManifests!());
		if (!plugins.plugins[id]) {
			if (typeof plugins.enablePluginAndSave === "function") {
				await call(`enablePluginAndSave(${id})`, () => plugins.enablePluginAndSave!(id));
			} else if (typeof plugins.enablePlugin === "function") {
				await call(`enablePlugin(${id})`, () => plugins.enablePlugin!(id));
			} else {
				steps.push("no enable fn");
			}
		}
		steps.push(`loaded=${Object.keys(plugins.plugins).join(",")}`);
		return steps;
	}, pluginId);
	for (const step of trace) log.debug(`enable: ${step}`);

	await page.waitForFunction(
		(id) =>
			Boolean(
				(window as unknown as { app?: { plugins?: { plugins?: Record<string, unknown> } } }).app?.plugins?.plugins?.[id]
			),
		pluginId,
		{ timeout: timeoutMs }
	);
	log.debug(`ensurePluginLoaded: ${pluginId} loaded`);
}

function pipeRendererConsole(page: Page, log: Logger): void {
	page.on("console", (msg) => log.debug(`console.${msg.type()}: ${msg.text()}`));
	// Page errors and crashes are real failures — promote to info so they show
	// up without requiring --debug.
	page.on("pageerror", (err) => log.info(`pageerror: ${err.message}\n${err.stack ?? ""}`));
	page.on("crash", () => log.info(`PAGE CRASHED`));
}

// Format: YYYY-MM-DD-HHmm (local time) — chronologically sortable in `ls`, and
// easy for the cleanup task to parse. Local (not UTC) because humans reading
// their own .cache/vaults/ expect wall-clock time.
function formatRunTimestamp(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`-${pad(date.getHours())}${pad(date.getMinutes())}`
	);
}
