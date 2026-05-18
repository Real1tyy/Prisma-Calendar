#!/usr/bin/env tsx
// Generic E2E prepare step: ensure the plugin's build artifacts exist before
// Playwright stages them into each temp vault. Invoked from the plugin's CWD
// (so `process.cwd()` is the plugin root). Pass `--skip-if-built` to no-op
// when main.js/manifest.json/styles.css are already present.
import { ensurePluginBuilt } from "../../src/testing/e2e/build";

ensurePluginBuilt({
	pluginRoot: process.cwd(),
	skipIfBuilt: process.argv.includes("--skip-if-built"),
});
