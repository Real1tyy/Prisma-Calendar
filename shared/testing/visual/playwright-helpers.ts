import { existsSync, readdirSync } from "node:fs";

/** List `*.html` fixture files in `fixturesDir`, sorted. Returns `[]` if the directory is missing. */
export function listFixtureFiles(fixturesDir: string): string[] {
	if (!existsSync(fixturesDir)) return [];
	return readdirSync(fixturesDir)
		.filter((f) => f.endsWith(".html"))
		.sort();
}
