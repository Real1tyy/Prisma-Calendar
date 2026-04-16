import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { parse as parseYaml } from "yaml";

// File-on-disk truth helpers. Every E2E assertion that touches persistent
// state should validate the file too — the DOM lies, the vault is truth.

function matchFrontmatter(raw: string): string | null {
	// Match a leading YAML block `---\n...\n---`. We cannot rely on Obsidian's
	// parser because `app.metadataCache` lags behind writes in test timings.
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1]! : null;
}

/** Parse the YAML frontmatter at the top of a note. Returns an empty object when absent. */
export function readEventFrontmatter(vaultDir: string, relativePath: string): Record<string, unknown> {
	const absolute = join(vaultDir, relativePath);
	const raw = readFileSync(absolute, "utf8");
	const block = matchFrontmatter(raw);
	if (block === null) return {};
	const parsed = parseYaml(block) as unknown;
	return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
}

/**
 * Assert that every key in `expected` is present with a deep-equal value on the
 * given event file. Throws an Error with a diff when a key is missing or off.
 */
export function expectFrontmatter(vaultDir: string, relativePath: string, expected: Record<string, unknown>): void {
	const actual = readEventFrontmatter(vaultDir, relativePath);
	const misses: string[] = [];
	for (const [key, want] of Object.entries(expected)) {
		const got = actual[key];
		if (!deepEqual(got, want)) {
			misses.push(`  ${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
		}
	}
	if (misses.length > 0) {
		throw new Error(`frontmatter mismatch in ${relativePath}:\n${misses.join("\n")}`);
	}
}

/** Absolute paths to every `.md` under the events subdirectory. Recurses. */
export function listEventFiles(vaultDir: string, subdir = "Events"): string[] {
	const root = join(vaultDir, subdir);
	if (!existsSync(root)) return [];
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			const s = statSync(full);
			if (s.isDirectory()) walk(full);
			else if (s.isFile() && entry.endsWith(".md")) out.push(full);
		}
	};
	walk(root);
	return out;
}

/** Parse a plugin's `data.json` from the vault's `.obsidian/plugins/<id>/` directory. */
export function readPluginData(vaultDir: string, pluginId: string): unknown {
	const path = join(vaultDir, ".obsidian", "plugins", pluginId, "data.json");
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

/**
 * Assert that a plugin's `data.json` matches the expected partial state.
 * Keys in `expected` may be dotted paths (e.g. `"general.stopwatch.enabled"`)
 * for nested assertions; top-level keys are deep-equal compared directly.
 */
export function expectPluginData(vaultDir: string, pluginId: string, expected: Record<string, unknown>): void {
	const actual = readPluginData(vaultDir, pluginId);
	if (actual === null || typeof actual !== "object") {
		throw new Error(`plugin data.json missing or non-object for ${pluginId}`);
	}
	const misses: string[] = [];
	for (const [path, want] of Object.entries(expected)) {
		const got = path.includes(".")
			? getByPath(actual as Record<string, unknown>, path)
			: (actual as Record<string, unknown>)[path];
		if (!deepEqual(got, want)) {
			misses.push(`  ${path}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
		}
	}
	if (misses.length > 0) {
		throw new Error(`data.json mismatch for ${pluginId}:\n${misses.join("\n")}`);
	}
}

function getByPath(root: Record<string, unknown>, path: string): unknown {
	let cur: unknown = root;
	for (const segment of path.split(".")) {
		if (cur === null || typeof cur !== "object") return undefined;
		cur = (cur as Record<string, unknown>)[segment];
	}
	return cur;
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null || typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((v, i) => deepEqual(v, b[i]));
	}
	const ao = a as Record<string, unknown>;
	const bo = b as Record<string, unknown>;
	const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
	for (const k of keys) if (!deepEqual(ao[k], bo[k])) return false;
	return true;
}
