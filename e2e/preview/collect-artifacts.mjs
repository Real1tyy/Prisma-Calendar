// Post-run collector for `pnpm run preview:tutorial`. Playwright writes the tour
// video into a hashed e2e/test-results/<…>/video.webm dir; this lifts the newest
// preview video to a stable, easy-to-find path next to the per-step screenshots
// and prints every artifact location (file paths for docs/agents + the command
// to open the interactive report for a human).
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RESULTS_DIR = "e2e/test-results";
const DEST_DIR = "e2e/.preview/tutorial";
const VIDEO_DEST = join(DEST_DIR, "walkthrough.webm");

/** Newest video.webm under a test-results dir whose name is the preview spec. */
function findPreviewVideo() {
	if (!existsSync(RESULTS_DIR)) return null;
	let newest = null;
	for (const entry of readdirSync(RESULTS_DIR)) {
		if (!entry.includes("tutorial-walkthrough")) continue;
		const video = join(RESULTS_DIR, entry, "video.webm");
		if (!existsSync(video)) continue;
		const mtime = statSync(video).mtimeMs;
		if (!newest || mtime > newest.mtime) newest = { video, mtime };
	}
	return newest?.video ?? null;
}

const screenshots = existsSync(DEST_DIR)
	? readdirSync(DEST_DIR)
			.filter((f) => f.endsWith(".png"))
			.sort()
	: [];

const video = findPreviewVideo();
if (video) {
	mkdirSync(DEST_DIR, { recursive: true });
	cpSync(video, VIDEO_DEST);
}

console.log("\n────────────────────────────────────────────────────────");
console.log("🎬 Tutorial walkthrough preview");
console.log("────────────────────────────────────────────────────────");
console.log(video ? `  Video:        ${VIDEO_DEST}` : "  Video:        (none recorded — check the run output above)");
console.log(`  Screenshots:  ${DEST_DIR}/  (${screenshots.length} frame${screenshots.length === 1 ? "" : "s"})`);
for (const f of screenshots) console.log(`                  • ${f}`);
console.log(`  Report (UI):  pnpm --filter prisma-calendar exec playwright show-report e2e/playwright-report`);
console.log("────────────────────────────────────────────────────────\n");
