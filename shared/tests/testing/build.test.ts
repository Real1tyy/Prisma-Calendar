import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensurePluginBuilt } from "../../src/testing/e2e/build";

/**
 * Drives `ensurePluginBuilt` against a throwaway plugin tree on disk. The
 * "build command" is a sentinel `touch` so a test can assert whether a rebuild
 * was triggered by checking for the marker file — no real bundler involved.
 */
const MARKER = "REBUILT_MARKER";

/** mtime helpers in seconds — fs mtimes round to whole seconds on some platforms. */
const SECOND = 1000;

function setMtime(path: string, epochMs: number): void {
	const seconds = epochMs / SECOND;
	utimesSync(path, seconds, seconds);
}

describe("ensurePluginBuilt — staleness detection", () => {
	let root: string;

	const buildCommand = ["touch", MARKER] as const;
	const rebuilt = (): boolean => {
		try {
			statSync(join(root, MARKER));
			return true;
		} catch {
			return false;
		}
	};

	/** Write the three default artifacts plus one source file, then pin mtimes. */
	function scaffold({ mainJs, stylesCss, source }: { mainJs: number; stylesCss: number; source: number }): void {
		writeFileSync(join(root, "main.js"), "// bundle");
		writeFileSync(join(root, "styles.css"), "/* styles */");
		writeFileSync(join(root, "manifest.json"), "{}");
		const srcDir = join(root, "src");
		mkdirSync(srcDir, { recursive: true });
		writeFileSync(join(srcDir, "index.ts"), "export {};");

		setMtime(join(root, "main.js"), mainJs);
		setMtime(join(root, "styles.css"), stylesCss);
		// manifest.json is source-controlled — give it an ancient mtime so it
		// would wrongly force a rebuild if it were ever part of the comparison.
		setMtime(join(root, "manifest.json"), 1000 * SECOND);
		setMtime(join(srcDir, "index.ts"), source);
	}

	function run(skipIfBuilt = true): void {
		ensurePluginBuilt({
			pluginRoot: root,
			sourceDirs: ["src"],
			buildCommand,
			skipIfBuilt,
		});
	}

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "ensure-plugin-built-"));
	});

	afterEach(() => {
		rmSync(root, { recursive: true, force: true });
	});

	it("skips the build when every output is newer than the source", () => {
		scaffold({ mainJs: 3000 * SECOND, stylesCss: 3000 * SECOND, source: 2000 * SECOND });

		run();

		expect(rebuilt()).toBe(false);
	});

	it("rebuilds when the source is newer than the outputs", () => {
		scaffold({ mainJs: 2000 * SECOND, stylesCss: 2000 * SECOND, source: 3000 * SECOND });

		run();

		expect(rebuilt()).toBe(true);
	});

	// The regression: a freshly-touched styles.css must not mask a stale main.js.
	// Max-over-artifacts would call this fresh; oldest-over-build-outputs catches it.
	it("rebuilds when main.js is stale even though styles.css is fresh", () => {
		scaffold({ mainJs: 2000 * SECOND, stylesCss: 4000 * SECOND, source: 3000 * SECOND });

		run();

		expect(rebuilt()).toBe(true);
	});

	it("ignores manifest.json's ancient mtime when deciding freshness", () => {
		// manifest.json was pinned to epoch 1000s in scaffold — far older than the
		// source. If it counted toward freshness the build would always run.
		scaffold({ mainJs: 3000 * SECOND, stylesCss: 3000 * SECOND, source: 2000 * SECOND });

		run();

		expect(rebuilt()).toBe(false);
	});

	it("rebuilds when an artifact is missing", () => {
		scaffold({ mainJs: 3000 * SECOND, stylesCss: 3000 * SECOND, source: 2000 * SECOND });
		rmSync(join(root, "main.js"));

		run();

		expect(rebuilt()).toBe(true);
	});

	it("always rebuilds when skipIfBuilt is false", () => {
		scaffold({ mainJs: 3000 * SECOND, stylesCss: 3000 * SECOND, source: 2000 * SECOND });

		run(false);

		expect(rebuilt()).toBe(true);
	});
});
