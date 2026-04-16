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
 */
export function sharedVitestAliases(pluginDir: string) {
	const sharedSrc = path.resolve(pluginDir, "../shared/src");
	const sharedReactSrc = path.resolve(pluginDir, "../shared-react/src");
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
