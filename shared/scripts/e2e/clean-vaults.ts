#!/usr/bin/env tsx
// Delete stale per-run vaults under `<pluginRoot>/e2e/.cache/vaults/`.
//
// Each vault dir is named `YYYY-MM-DD-HHmm-<prefix>-<uuid>` (see
// shared/src/testing/e2e/bootstrap.ts). We parse the leading date and drop any
// directory older than the configured threshold.
//
// Usage (from monorepo root — the mise task uses this form):
//   tsx shared/scripts/e2e/clean-vaults.ts                      # all plugins, keep today
//   tsx shared/scripts/e2e/clean-vaults.ts --plugin=<name>      # single plugin
//   tsx shared/scripts/e2e/clean-vaults.ts --root=<dir>         # single custom root
//   tsx shared/scripts/e2e/clean-vaults.ts --days=7             # keep last 7 days
//   tsx shared/scripts/e2e/clean-vaults.ts --all                # wipe everything
//   tsx shared/scripts/e2e/clean-vaults.ts --dry-run            # print, don't delete
//
// Directories whose names don't match the expected pattern are left alone.
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Args = {
	days: number;
	all: boolean;
	dryRun: boolean;
	roots: readonly string[];
};

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");

function parseArgs(argv: readonly string[]): Args {
	let days = 1; // "keep today only" — anything older than today goes
	let all = false;
	let dryRun = false;
	let explicitRoot: string | null = null;
	let plugin: string | null = null;
	for (const arg of argv) {
		if (arg === "--all") all = true;
		else if (arg === "--dry-run") dryRun = true;
		else if (arg.startsWith("--days=")) days = Number(arg.slice("--days=".length));
		else if (arg.startsWith("--root=")) explicitRoot = resolve(arg.slice("--root=".length));
		else if (arg.startsWith("--plugin=")) plugin = arg.slice("--plugin=".length);
	}
	if (!Number.isFinite(days) || days < 0) {
		throw new Error(`--days must be a non-negative number, got: ${days}`);
	}
	const roots = resolveRoots({ explicitRoot, plugin });
	return { days, all, dryRun, roots };
}

function resolveRoots(opts: { explicitRoot: string | null; plugin: string | null }): readonly string[] {
	if (opts.explicitRoot) return [opts.explicitRoot];
	if (opts.plugin) return [resolve(REPO_ROOT, opts.plugin, "e2e", ".cache", "vaults")];
	return discoverPluginRoots();
}

function discoverPluginRoots(): readonly string[] {
	return readdirSync(REPO_ROOT, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(REPO_ROOT, entry.name, "e2e")))
		.map((entry) => join(REPO_ROOT, entry.name, "e2e", ".cache", "vaults"));
}

const DIR_NAME_RE = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})-/;

function parseDirDate(name: string): Date | null {
	const m = DIR_NAME_RE.exec(name);
	if (!m) return null;
	const [, y, mo, d, h, mi] = m;
	return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

function cleanRoot(root: string, args: Args, cutoff: Date): { kept: number; removed: number; skipped: number } {
	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			console.log(`[clean-vaults] ${root} does not exist — skipping.`);
			return { kept: 0, removed: 0, skipped: 0 };
		}
		throw err;
	}

	let kept = 0;
	let removed = 0;
	let skipped = 0;

	for (const name of entries) {
		const full = join(root, name);
		if (!statSync(full).isDirectory()) {
			skipped++;
			continue;
		}
		if (args.all) {
			if (args.dryRun) console.log(`[clean-vaults] DRY would remove ${full}`);
			else rmSync(full, { recursive: true, force: true });
			removed++;
			continue;
		}
		const date = parseDirDate(name);
		if (!date) {
			console.log(`[clean-vaults] skipping ${full} (unrecognised name)`);
			skipped++;
			continue;
		}
		if (date < cutoff) {
			if (args.dryRun) console.log(`[clean-vaults] DRY would remove ${full} (${date.toISOString()})`);
			else rmSync(full, { recursive: true, force: true });
			removed++;
		} else {
			kept++;
		}
	}
	return { kept, removed, skipped };
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	if (args.roots.length === 0) {
		console.log(`[clean-vaults] no plugins with an e2e/ directory found.`);
		return;
	}

	// Cutoff: midnight, N days before today. `days=1` means "delete anything
	// before today at 00:00"; `days=7` means "delete anything before one week
	// ago at 00:00".
	const cutoff = new Date();
	cutoff.setHours(0, 0, 0, 0);
	cutoff.setDate(cutoff.getDate() - (args.days - 1));

	let totalKept = 0;
	let totalRemoved = 0;
	let totalSkipped = 0;
	for (const root of args.roots) {
		console.log(`[clean-vaults] ${root}`);
		const { kept, removed, skipped } = cleanRoot(root, args, cutoff);
		totalKept += kept;
		totalRemoved += removed;
		totalSkipped += skipped;
	}

	const mode = args.all ? "all" : `older than ${args.days}d (before ${cutoff.toISOString().slice(0, 10)})`;
	const verb = args.dryRun ? "would remove" : "removed";
	console.log(
		`[clean-vaults] ${mode} — ${verb}: ${totalRemoved}, kept: ${totalKept}, skipped: ${totalSkipped} (across ${args.roots.length} root(s))`
	);
}

main();
