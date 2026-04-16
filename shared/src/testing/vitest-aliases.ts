import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Vitest alias entries that resolve `@real1ty-obsidian-plugins[-react]` imports
 * straight to the shared packages' TypeScript source, bypassing the built `dist/`.
 *
 * Consumed by each plugin's `vitest.config.ts` so that test runs don't depend
 * on `turbo run build` of the shared packages — this decouples `test:changed`
 * cache invalidation from `shared/**` build-hash churn.
 *
 * Must be imported via a relative path from plugin configs (not via the package
 * alias itself) to avoid a chicken-and-egg at config load time.
 *
 * Layout-aware: in the monorepo, `shared/` is a sibling of each plugin; in
 * public mirrors, the sync script nests `shared/` inside the plugin root. We
 * prefer the nested copy when present and fall back to the sibling layout.
 */
function resolveSharedPackageSrc(pluginDir: string, name: string): string {
	const nested = path.resolve(pluginDir, name, "src");
	if (fs.existsSync(path.join(nested, "index.ts"))) return nested;
	return path.resolve(pluginDir, "..", name, "src");
}

export function sharedVitestAliases(pluginDir: string) {
	const sharedSrc = resolveSharedPackageSrc(pluginDir, "shared");
	const sharedReactSrc = resolveSharedPackageSrc(pluginDir, "shared-react");
	return [
		{
			find: /^@real1ty-obsidian-plugins-react$/,
			replacement: path.resolve(sharedReactSrc, "index.ts"),
		},
		{
			find: /^@real1ty-obsidian-plugins-react\/(.*)$/,
			replacement: path.resolve(sharedReactSrc, "$1"),
		},
		{
			find: /^@real1ty-obsidian-plugins\/testing\/visual$/,
			replacement: path.resolve(sharedSrc, "testing/visual/index.ts"),
		},
		{
			find: /^@real1ty-obsidian-plugins\/testing\/e2e$/,
			replacement: path.resolve(sharedSrc, "testing/e2e/index.ts"),
		},
		{
			find: /^@real1ty-obsidian-plugins\/testing$/,
			replacement: path.resolve(sharedSrc, "testing/index.ts"),
		},
		{
			find: /^@real1ty-obsidian-plugins$/,
			replacement: path.resolve(sharedSrc, "index.ts"),
		},
		{
			find: /^@real1ty-obsidian-plugins\/(.*)$/,
			replacement: path.resolve(sharedSrc, "$1"),
		},
	];
}
