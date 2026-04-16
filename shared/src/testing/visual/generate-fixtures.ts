import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { OBSIDIAN_THEMES, type ObsidianTheme } from "./css-vars";
import { buildHarnessHtml, readPluginStyles } from "./harness";
import type { Scenario } from "./scenario";

export interface GenerateFixturesOptions {
	scenarios: readonly Scenario[];
	/** Absolute directory to write `<scenario>.<theme>.html` files into. Recreated on each run. */
	fixturesDir: string;
	/** Absolute path to the plugin's compiled `styles.css`. */
	pluginStylesPath: string;
	/** Themes to render. Defaults to ["light", "dark"]. */
	themes?: readonly ObsidianTheme[];
}

export interface GenerateFixturesResult {
	written: number;
	files: string[];
}

/**
 * Render every scenario × theme to a standalone HTML file under `fixturesDir`.
 * Returns the count of files written. Designed to be called from a vitest test
 * (so it inherits the obsidian alias + jsdom + tsconfig paths).
 */
export function generateFixtures(options: GenerateFixturesOptions): GenerateFixturesResult {
	const { scenarios, fixturesDir, pluginStylesPath, themes = OBSIDIAN_THEMES } = options;
	const pluginStyles = readPluginStyles(pluginStylesPath);

	rmSync(fixturesDir, { recursive: true, force: true });
	mkdirSync(fixturesDir, { recursive: true });

	let written = 0;
	for (const scenario of scenarios) {
		const rendered = scenario.render();
		if (!rendered) {
			throw new Error(`Scenario "${scenario.name}" did not return an element.`);
		}
		const innerHtml = rendered.outerHTML;
		for (const theme of themes) {
			const html = buildHarnessHtml(innerHtml, {
				theme,
				title: `${scenario.name} (${theme})`,
				pluginStyles,
				width: scenario.width,
			});
			writeFileSync(join(fixturesDir, `${scenario.name}.${theme}.html`), html, "utf-8");
			written++;
		}
	}

	const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".html"));
	return { written, files };
}
