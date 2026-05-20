import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type EnsurePluginBuiltOptions = {
	/** Absolute path to the plugin root (folder containing package.json + manifest.json). */
	pluginRoot: string;
	/** Files that must exist at pluginRoot to consider it "already built". */
	artifacts?: readonly string[];
	/**
	 * Subset of `artifacts` that the build command actually regenerates every
	 * run (the real bundle outputs). Freshness compares against the OLDEST of
	 * these — so a fresh `styles.css` can't mask a stale `main.js`. Excludes
	 * source-controlled artifacts like `manifest.json` whose mtime tracks the
	 * git checkout, not the build. Defaults to `main.js` + `styles.css`.
	 */
	buildOutputs?: readonly string[];
	/**
	 * Directories (relative to `pluginRoot`) whose mtimes invalidate the
	 * cached build. Defaults cover the plugin's own source plus the workspace
	 * `shared/` / `shared-react/` packages — the common case in this monorepo.
	 * An empty array disables staleness detection.
	 */
	sourceDirs?: readonly string[];
	/** Command to run when artifacts are missing or stale. Defaults to `pnpm run build`. */
	buildCommand?: readonly string[];
	/** When true, skip rebuilding if artifacts exist AND are fresher than sources. Default: true. */
	skipIfBuilt?: boolean;
};

const DEFAULT_ARTIFACTS = ["main.js", "manifest.json", "styles.css"] as const;
const DEFAULT_BUILD_OUTPUTS = ["main.js", "styles.css"] as const;
const DEFAULT_SOURCE_DIRS = ["src", "../shared/src", "../shared-react/src"] as const;

/** Shared primitive: newest mtime among the given paths. Missing paths skipped. */
function newestMtime(paths: Iterable<string>): number {
	let newest = 0;
	for (const path of paths) {
		let st;
		try {
			st = statSync(path);
		} catch {
			continue;
		}
		if (st.isFile() && st.mtimeMs > newest) newest = st.mtimeMs;
	}
	return newest;
}

/** Shared primitive: oldest mtime among the given paths. Missing paths skipped; 0 if none exist. */
function oldestMtime(paths: Iterable<string>): number {
	let oldest = Infinity;
	for (const path of paths) {
		let st;
		try {
			st = statSync(path);
		} catch {
			continue;
		}
		if (st.isFile() && st.mtimeMs < oldest) oldest = st.mtimeMs;
	}
	return oldest === Infinity ? 0 : oldest;
}

/** Yield every non-hidden source file under `root`, skipping `node_modules` / `dist`. */
function* walkSourceFiles(root: string): Generator<string> {
	if (!existsSync(root)) return;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
			const full = resolve(dir, entry);
			let st;
			try {
				st = statSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) stack.push(full);
			else if (st.isFile()) yield full;
		}
	}
}

/**
 * Build's effective completion time = OLDEST build-output mtime. A build is
 * fresh only if *every* regenerated output postdates every source — so the
 * oldest output is the one that decides. Using the newest (max) would let a
 * separately-touched output mask a stale one: e.g. an `apply`/`merge` that
 * rewrites `styles.css` after `main.js` was last built leaves a fresh
 * `styles.css` mtime hiding a stale `main.js`, and the check would wrongly
 * skip the rebuild. `manifest.json` is excluded from `buildOutputs` because
 * it's source-controlled — its mtime is the git-checkout time, unrelated to
 * the build.
 */
function oldestBuildOutputMtime(pluginRoot: string, buildOutputs: readonly string[]): number {
	return oldestMtime(buildOutputs.map((file) => resolve(pluginRoot, file)));
}

/** Newest source-file mtime across `sourceDirs`. Returns 0 if no sources tracked. */
function newestSourceMtime(pluginRoot: string, sourceDirs: readonly string[]): number {
	let newest = 0;
	for (const dir of sourceDirs) {
		const m = newestMtime(walkSourceFiles(resolve(pluginRoot, dir)));
		if (m > newest) newest = m;
	}
	return newest;
}

/**
 * Ensure the plugin bundle is built AND fresher than its source files. Called
 * before staging artifacts into the per-test vault. Rebuilds when:
 *  - any artifact is missing, OR
 *  - `skipIfBuilt` is false, OR
 *  - any source file under `sourceDirs` has a newer mtime than the oldest
 *    artifact (catches `git checkout` / `git merge` / branch switches where
 *    source changed but `main.js` wasn't rebuilt).
 */
export function ensurePluginBuilt(options: EnsurePluginBuiltOptions): void {
	const artifacts = options.artifacts ?? DEFAULT_ARTIFACTS;
	const buildOutputs = options.buildOutputs ?? DEFAULT_BUILD_OUTPUTS;
	const sourceDirs = options.sourceDirs ?? DEFAULT_SOURCE_DIRS;
	const skipIfBuilt = options.skipIfBuilt ?? true;

	const missing = artifacts.filter((file) => !existsSync(resolve(options.pluginRoot, file)));
	const artifactMtime = missing.length === 0 ? oldestBuildOutputMtime(options.pluginRoot, buildOutputs) : 0;
	const sourceMtime = newestSourceMtime(options.pluginRoot, sourceDirs);
	const isStale = artifactMtime > 0 && sourceMtime > artifactMtime;

	let reason: string | null = null;
	if (missing.length > 0) reason = `missing artifacts: ${missing.join(", ")}`;
	else if (!skipIfBuilt) reason = "skipIfBuilt disabled";
	else if (isStale) {
		const ageMs = sourceMtime - artifactMtime;
		reason = `stale bundle: source newer than build by ${(ageMs / 1000).toFixed(1)}s`;
	}

	if (reason === null) {
		console.log("[e2e] build artifacts fresh, skipping build.");
		return;
	}

	const [cmd, ...args] = options.buildCommand ?? ["pnpm", "run", "build"];
	if (!cmd) throw new Error("ensurePluginBuilt: empty buildCommand");
	console.log(`[e2e] building plugin via '${cmd} ${args.join(" ")}' (${reason})`);
	const result = spawnSync(cmd, args, { cwd: options.pluginRoot, stdio: "inherit" });
	if (result.status !== 0) {
		throw new Error(`[e2e] build failed with status ${result.status ?? "null"}`);
	}
}
