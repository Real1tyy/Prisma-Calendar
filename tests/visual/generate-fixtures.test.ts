/**
 * Regenerates visual-regression HTML fixtures from every scenario.
 *
 * This is a vitest test (rather than a standalone script) so it inherits
 * vitest's jsdom environment + the `obsidian` module alias — which means the
 * scenarios can import real plugin components that transitively depend on
 * Obsidian APIs. Running `pnpm test` keeps fixtures in sync with source.
 *
 * The output HTML files are ephemeral — gitignored. They're the bridge
 * between this Node-side rendering and Playwright's screenshot tests. The
 * committed source of truth is the baseline PNGs under
 * `tests/visual/fixtures.visual.spec.ts-snapshots/`.
 */

import { resolve } from "node:path";

import { generateFixtures } from "@real1ty-obsidian-plugins/testing/visual";
import { describe, expect, it } from "vitest";

import { ALL_SCENARIOS } from "./scenarios";

const PLUGIN_ROOT = resolve(__dirname, "..", "..");
const FIXTURES_DIR = resolve(__dirname, "fixtures");
const PLUGIN_STYLES_PATH = resolve(PLUGIN_ROOT, "styles.css");

describe("visual fixtures", () => {
	it("renders every scenario and writes an HTML file per theme", () => {
		const { written, files } = generateFixtures({
			scenarios: ALL_SCENARIOS,
			fixturesDir: FIXTURES_DIR,
			pluginStylesPath: PLUGIN_STYLES_PATH,
		});

		expect(files.length).toBe(written);
		expect(files.length).toBe(ALL_SCENARIOS.length * 2);
	});
});
