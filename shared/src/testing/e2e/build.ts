import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export type EnsurePluginBuiltOptions = {
	/** Absolute path to the plugin root (folder containing package.json + manifest.json). */
	pluginRoot: string;
	/** Files that must exist at pluginRoot to consider it "already built". */
	artifacts?: readonly string[];
	/** Command to run when artifacts are missing. Defaults to `pnpm run build`. */
	buildCommand?: readonly string[];
	/** When true, skip rebuilding if artifacts are present. Default: true. */
	skipIfBuilt?: boolean;
};

const DEFAULT_ARTIFACTS = ["main.js", "manifest.json", "styles.css"] as const;

/**
 * Ensure the plugin bundle is built. Called before staging artifacts into the
 * per-test vault. Returns silently if the artifacts already exist and
 * `skipIfBuilt` is true (default).
 */
export function ensurePluginBuilt(options: EnsurePluginBuiltOptions): void {
	const artifacts = options.artifacts ?? DEFAULT_ARTIFACTS;
	const skipIfBuilt = options.skipIfBuilt ?? true;

	const missing = artifacts.filter((file) => !existsSync(resolve(options.pluginRoot, file)));
	if (missing.length === 0 && skipIfBuilt) {
		console.log("[e2e] build artifacts already present, skipping build.");
		return;
	}

	const [cmd, ...args] = options.buildCommand ?? ["pnpm", "run", "build"];
	if (!cmd) throw new Error("ensurePluginBuilt: empty buildCommand");
	console.log(`[e2e] building plugin via '${cmd} ${args.join(" ")}' (missing: ${missing.join(", ") || "none"})`);
	const result = spawnSync(cmd, args, { cwd: options.pluginRoot, stdio: "inherit" });
	if (result.status !== 0) {
		throw new Error(`[e2e] build failed with status ${result.status ?? "null"}`);
	}
}
