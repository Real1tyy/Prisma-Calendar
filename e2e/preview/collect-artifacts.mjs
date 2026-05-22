// Post-run collector for `pnpm run preview:tutorial`. The preview spec writes one
// PNG per tour step into e2e/.preview/tutorial/; Playwright can't record real video
// for the Obsidian harness (it connects over CDP, not a browser context), so this
// stitches those frames into a watchable/embeddable walkthrough.mp4 + walkthrough.gif
// with ffmpeg and prints every artifact location.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "e2e/.preview/tutorial";
const MP4 = join(DIR, "walkthrough.mp4");
const GIF = join(DIR, "walkthrough.gif");
const SECONDS_PER_FRAME = 1.6;

const frames = existsSync(DIR)
	? readdirSync(DIR)
			.filter((f) => f.endsWith(".png"))
			.sort()
	: [];

function ffmpegAvailable() {
	return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

function assembleVideos() {
	const input = ["-y", "-framerate", String(1 / SECONDS_PER_FRAME), "-pattern_type", "glob", "-i", join(DIR, "*.png")];
	const mp4 = spawnSync(
		"ffmpeg",
		[...input, "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-r", "30", MP4],
		{ stdio: "ignore" }
	);
	const gif = spawnSync(
		"ffmpeg",
		[...input, "-vf", "scale=900:-2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", GIF],
		{ stdio: "ignore" }
	);
	return { mp4: mp4.status === 0, gif: gif.status === 0 };
}

console.log("\n────────────────────────────────────────────────────────");
console.log("🎬 Tutorial walkthrough preview");
console.log("────────────────────────────────────────────────────────");
if (frames.length === 0) {
	console.log("  ⚠️  No frames found — did the preview run write screenshots?");
} else {
	console.log(`  Frames:       ${DIR}/  (${frames.length})`);
	for (const f of frames) console.log(`                  • ${f}`);
	if (ffmpegAvailable()) {
		const { mp4, gif } = assembleVideos();
		if (mp4) console.log(`  Video (mp4):  ${MP4}`);
		if (gif) console.log(`  Video (gif):  ${GIF}`);
		if (!mp4 && !gif) console.log("  ⚠️  ffmpeg failed to assemble the video — review the frames above.");
	} else {
		console.log("  ℹ️  Install ffmpeg to auto-assemble the frames into walkthrough.mp4 / .gif.");
	}
}
console.log(`  Report (UI):  pnpm --filter prisma-calendar exec playwright show-report e2e/playwright-report`);
console.log("────────────────────────────────────────────────────────\n");
