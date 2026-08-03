import { describe, expect, it, vi } from "vitest";

import { assertNoNodeBuiltinImports } from "../../configs/vite-plugin-config";

/**
 * The guard's whole value is *which* signal it reads. A top-level
 * `require("node:http")` is fatal on mobile; the same call nested in a
 * try/catch (the vendored `sax` parser's `require("stream")`) degrades safely
 * and must not fail the build. Rollup's `chunk.imports` lists only hoisted
 * static imports, so reading it — rather than grepping `chunk.code` — is what
 * separates the two. These tests pin that choice.
 *
 * See [[spec-no-node-builtins-in-bundles]].
 */
function runGuard(chunk: { imports: string[]; code?: string; moduleIds?: string[] }) {
	const plugin = assertNoNodeBuiltinImports("/repo/PluginDir");
	const error = vi.fn((message: string) => {
		throw new Error(message);
	});
	const context = {
		error,
		getModuleInfo: (id: string) => ({ importedIds: id === "/repo/shared/src/server.ts" ? ["node:http"] : [] }),
	};
	const generateBundle = plugin.generateBundle as unknown as (
		this: typeof context,
		options: unknown,
		bundle: unknown
	) => void;

	const run = () =>
		generateBundle.call(context, {}, { "main.js": { type: "chunk", code: "", moduleIds: [], ...chunk } });

	return { run, error };
}

describe("assertNoNodeBuiltinImports", () => {
	it("should pass a chunk whose only static imports are Obsidian-provided externals", () => {
		const { run, error } = runGuard({ imports: ["obsidian", "@codemirror/view", "@lezer/common"] });

		expect(run).not.toThrow();
		expect(error).not.toHaveBeenCalled();
	});

	it.each(["node:http", "node:fs/promises", "fs", "child_process"])(
		"should fail a chunk that statically imports %s",
		(builtin) => {
			const { run } = runGuard({ imports: ["obsidian", builtin] });

			expect(run).toThrow(builtin);
		}
	);

	it("should name the module that pulled the builtin in", () => {
		const { run } = runGuard({
			imports: ["node:http"],
			moduleIds: ["/repo/shared/src/server.ts", "/repo/shared/src/unrelated.ts"],
		});

		expect(run).toThrow("../shared/src/server.ts");
	});

	it("should ignore a lazy require in the emitted code that is not a static import", () => {
		const { run, error } = runGuard({
			imports: ["obsidian"],
			code: 'var o;try{o=require("stream").Stream}catch(e){o=function(){}}',
		});

		expect(run).not.toThrow();
		expect(error).not.toHaveBeenCalled();
	});

	it("should skip assets, which have no import graph", () => {
		const plugin = assertNoNodeBuiltinImports("/repo/PluginDir");
		const error = vi.fn();
		const generateBundle = plugin.generateBundle as unknown as (
			this: { error: typeof error },
			options: unknown,
			bundle: unknown
		) => void;

		generateBundle.call({ error }, {}, { "styles.css": { type: "asset", source: "" } });

		expect(error).not.toHaveBeenCalled();
	});
});
