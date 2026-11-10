import { existsSync, readdirSync, readFileSync } from "node:fs";

import obsidianmd from "eslint-plugin-obsidianmd";

// These require a separate UI/data migration or inspect publication metadata. The
// release config owns these checks and the deferred settings exception.
export const RELEASE_ONLY_RULES = {
	"obsidianmd/settings-tab/prefer-setting-definitions":
		"Deferred React settings migration; see decision-declarative-settings-adoption.",
	"obsidianmd/validate-manifest": "Reads manifest.json from process.cwd(), including the monorepo stub.",
	"obsidianmd/validate-license": "Inspects publication metadata at process.cwd().",
	"obsidianmd/sample-names": "Reads publication metadata at process.cwd().",
	"obsidianmd/ui/sentence-case": "Existing UI-copy migration in Fusion Goals and Notes Manipulator.",
	"obsidianmd/prefer-create-el": "Existing imperative UI migration in several plugins.",
	"obsidianmd/prefer-file-manager-trash-file": "Notes Manipulator still implements its existing deletion behavior.",
	"obsidianmd/rule-custom-message": "Existing console logging in Notes Manipulator.",
	"no-alert": "Page Header Manager still uses a confirmation dialog.",
	"import/no-extraneous-dependencies": "Some mirrors publish React through development dependencies.",
};

const EXTRA_RULES = new Set([
	"no-eval",
	"no-implied-eval",
	"no-self-compare",
	"no-implicit-globals",
	"no-restricted-globals",
	"@typescript-eslint/no-restricted-imports",
]);

const upstream = obsidianmd.configs.recommended;
const plugins = Object.assign({}, ...upstream.map((config) => config.plugins));
const recommendedRules = Object.assign({}, ...upstream.map((config) => config.rules));
const rules = Object.fromEntries(
	Object.entries(recommendedRules)
		.filter(([name, setting]) => {
			const severity = Array.isArray(setting) ? setting[0] : setting;
			return (
				severity !== "off" &&
				severity !== 0 &&
				!(name in RELEASE_ONLY_RULES) &&
				(name.startsWith("obsidianmd/") ||
					name.startsWith("eslint-comments/") ||
					name.startsWith("no-unsanitized/") ||
					name.startsWith("@microsoft/sdl/") ||
					EXTRA_RULES.has(name))
			);
		})
		.map(([name, setting]) => [name, ["error", ...(Array.isArray(setting) ? setting.slice(1) : [])]])
);

// Our own conventions, not Obsidian review rules — riding here so every plugin and
// mirror picks them up without a per-plugin config edit.
const HOUSE_RULES = {
	"no-restricted-syntax": [
		"error",
		{
			// [[decision-mobile-ui-conventions]]: focusing on open raises the phone keyboard.
			selector: "JSXAttribute[name.name='autoFocus']:not(:has(CallExpression[callee.name='shouldAutoFocus']))",
			message:
				'Gate autoFocus on shouldAutoFocus("always" | "desktop") from @real1ty/obsidian-plugins-react — decide whether opening this surface may raise a phone or tablet keyboard.',
		},
	],
};

const readManifest = (path) => JSON.parse(readFileSync(path, "utf8"));

export function readPluginManifests(workspace) {
	const rootManifest = readManifest(new URL("manifest.json", workspace));
	// A mirror has its real manifest at the root; this monorepo has a stub there.
	if (rootManifest.minAppVersion !== "0.0.0") return [{ directory: ".", manifest: rootManifest }];
	return readdirSync(workspace, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/manifest.json`, workspace)))
		.map((entry) => ({
			directory: entry.name,
			manifest: readManifest(new URL(`${entry.name}/manifest.json`, workspace)),
		}))
		.filter(({ manifest }) => manifest.minAppVersion && manifest.minAppVersion !== "0.0.0");
}

export function obsidianRuntimeConfig({ files = ["src/**/*.{ts,tsx}"], manifestPath }) {
	// Resolve from the caller, not this module: file: dependencies can be installed
	// into pnpm's virtual store, and mirror shared packages omit stub manifests.
	while (!existsSync(manifestPath)) {
		const parent = new URL("../manifest.json", manifestPath);
		if (parent.href === manifestPath.href) throw new Error(`No Obsidian manifest above ${manifestPath.href}`);
		manifestPath = parent;
	}
	const manifest = readManifest(manifestPath);
	const publishedPlugin = manifest.minAppVersion !== "0.0.0";
	const consumers = publishedPlugin
		? [manifest]
		: readPluginManifests(new URL("../", manifestPath)).map(({ manifest }) => manifest);
	const minimumAppVersion = consumers
		.map(({ minAppVersion }) => minAppVersion)
		.sort((left, right) => left.localeCompare(right, "en", { numeric: true }))[0];
	const runtimeRules = { ...rules };
	for (const [name, setting] of Object.entries(runtimeRules)) {
		if (!name.startsWith("obsidianmd/")) continue;
		const properties = obsidianmd.rules[name.slice("obsidianmd/".length)].meta.schema?.[0]?.properties;
		if (!properties) continue;
		if (!publishedPlugin && name.startsWith("obsidianmd/commands/") && (properties.pluginId || properties.pluginName)) {
			delete runtimeRules[name];
			continue;
		}
		const options = { ...setting[1] };
		if (properties.minAppVersion) options.minAppVersion = minimumAppVersion;
		if (properties.pluginId) options.pluginId = manifest.id;
		if (properties.pluginName) options.pluginName = publishedPlugin ? manifest.name : "";
		if (properties.isDesktopOnly)
			options.isDesktopOnly = consumers.every(({ isDesktopOnly }) => isDesktopOnly === true);
		if (Object.keys(options).length) runtimeRules[name] = ["error", options];
	}

	return {
		name: `obsidian-runtime/${publishedPlugin ? manifest.id : "shared"}`,
		files,
		ignores: ["**/testing/**", "**/tests/**", "**/*.test.*", "**/*.spec.*", "**/*.d.ts"],
		plugins,
		rules: { ...runtimeRules, ...HOUSE_RULES },
	};
}
