import { parseLinkedList } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";

export type DependencyGraph = Map<string, string[]>;
export type EventIdMap = Map<string, string>;

export function resolveWikiLinks(value: unknown, app: App): string[] {
	return parseLinkedList(value, {
		resolve: (linkPath) => app.metadataCache.getFirstLinkpathDest(linkPath, "")?.path,
	});
}

export function buildDependencyGraph(
	events: CalendarEvent[],
	settings: SingleCalendarConfig,
	app: App
): { graph: DependencyGraph; eventIdMap: EventIdMap } {
	const graph: DependencyGraph = new Map();
	const eventIdMap: EventIdMap = new Map();

	if (!settings.prerequisiteProp) return { graph, eventIdMap };

	for (const event of events) {
		eventIdMap.set(event.ref.filePath, event.id);

		const raw = event.meta[settings.prerequisiteProp];
		const prereqs = resolveWikiLinks(raw, app);
		if (prereqs.length > 0) {
			graph.set(event.ref.filePath, prereqs);
		}
	}

	return { graph, eventIdMap };
}

export function getPrerequisitesOf(graph: DependencyGraph, filePath: string): string[] {
	return graph.get(filePath) ?? [];
}

export function getDependentsOf(graph: DependencyGraph, filePath: string): string[] {
	return [...graph.entries()].filter(([, prereqs]) => prereqs.includes(filePath)).map(([fp]) => fp);
}

export function isConnected(graph: DependencyGraph, filePath: string): boolean {
	return graph.has(filePath) || getDependentsOf(graph, filePath).length > 0;
}
