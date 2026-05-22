import { installPerfBridge, perf } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../main";

// Stress/E2E-only: installs the generic in-app perf bridge (from
// @real1ty-obsidian-plugins/perf) and feeds it Prisma's live index/resource
// counts + identity. The shared bridge owns the global key + snapshot plumbing;
// this file only supplies the plugin-specific data. Installed only when
// `window.E2E` is set, so production runs pay nothing.

const MAX_SAMPLES_PER_TIMING = 2000;

function readResourceCounters(plugin: CustomCalendarPlugin): Record<string, number> {
	let eventsIndexed = 0;
	let untrackedEvents = 0;
	let activeViews = 0;
	for (const bundle of plugin.calendarBundles) {
		const info = bundle.getInfo();
		eventsIndexed += info.eventCount;
		untrackedEvents += info.untrackedEventCount;
		activeViews += plugin.app.workspace.getLeavesOfType(bundle.viewType).length;
	}
	return {
		"index.eventsIndexed": eventsIndexed,
		"index.untrackedEvents": untrackedEvents,
		"resources.activeCalendars": plugin.calendarBundles.length,
		"resources.activeViews": activeViews,
	};
}

export function installPrismaPerfBridge(plugin: CustomCalendarPlugin): void {
	const dispose = installPerfBridge({
		tracker: perf,
		trackerOptions: { maxSamplesPerTiming: MAX_SAMPLES_PER_TIMING, emitUserTimingMarks: true },
		resourceCounters: () => readResourceCounters(plugin),
		metadata: () => ({ pluginId: plugin.manifest.id, pluginVersion: plugin.manifest.version, mode: "stress" }),
	});
	plugin.register(dispose);
}
