import { describe, expect, it, vi } from "vitest";

import {
	buildDependencyGraph,
	getDependentsOf,
	getPrerequisitesOf,
	isConnected,
	resolveWikiLinks,
} from "../../src/core/dependency-graph";
import { createMockTimedEvent } from "../fixtures";
import { createMockSingleCalendarSettings } from "../setup";

function makeMockApp(resolveMap: Record<string, string | null> = {}): any {
	return {
		metadataCache: {
			getFirstLinkpathDest: vi.fn((linkpath: string) => {
				const path = resolveMap[linkpath.trim()];
				return path != null ? { path } : null;
			}),
		},
	};
}

describe("resolveWikiLinks", () => {
	it("parses single [[link]]", () => {
		const app = makeMockApp({ "Event A": "Events/event-a.md" });
		expect(resolveWikiLinks("[[Event A]]", app)).toEqual(["Events/event-a.md"]);
	});

	it("handles alias syntax [[path|alias]] — uses linkpath not alias", () => {
		const app = makeMockApp({ "Event A": "Events/event-a.md" });
		expect(resolveWikiLinks("[[Event A|My Label]]", app)).toEqual(["Events/event-a.md"]);
	});

	it("returns empty array for empty string", () => {
		expect(resolveWikiLinks("", makeMockApp())).toEqual([]);
	});

	it("returns empty array for non-string non-array", () => {
		expect(resolveWikiLinks(null, makeMockApp())).toEqual([]);
		expect(resolveWikiLinks(42, makeMockApp())).toEqual([]);
	});

	it("parses array of wiki-links", () => {
		const app = makeMockApp({ A: "a.md", B: "b.md" });
		expect(resolveWikiLinks(["[[A]]", "[[B]]"], app)).toEqual(["a.md", "b.md"]);
	});

	it("skips links that do not resolve", () => {
		const app = makeMockApp({ Real: "real.md" });
		expect(resolveWikiLinks(["[[Real]]", "[[Deleted Note]]"], app)).toEqual(["real.md"]);
	});

	it("handles plain string without brackets (e.g. already stripped)", () => {
		const app = makeMockApp({ Plain: "plain.md" });
		// A string without [[ ]] should not resolve since no brackets to strip
		expect(resolveWikiLinks("Plain", app)).toEqual([]);
	});
});

describe("buildDependencyGraph", () => {
	it("returns empty graph when prerequisiteProp is empty string", () => {
		const settings = { ...createMockSingleCalendarSettings(), prerequisiteProp: "" };
		const events = [createMockTimedEvent()];
		const { graph } = buildDependencyGraph(events, settings as any, makeMockApp());
		expect(graph.size).toBe(0);
	});

	it("returns empty graph when prerequisiteProp is falsy", () => {
		const settings = { ...createMockSingleCalendarSettings(), prerequisiteProp: undefined };
		const events = [createMockTimedEvent()];
		const { graph } = buildDependencyGraph(events, settings as any, makeMockApp());
		expect(graph.size).toBe(0);
	});

	it("builds graph from events with prerequisites", () => {
		const settings = { ...createMockSingleCalendarSettings(), prerequisiteProp: "Prerequisite" };
		const app = makeMockApp({ "Event A": "Events/a.md" });

		const depEvent = createMockTimedEvent({
			id: "uuid-b",
			ref: { filePath: "Events/b.md" },
			meta: { Prerequisite: ["[[Event A]]"] },
		});
		const preEvent = createMockTimedEvent({
			id: "uuid-a",
			ref: { filePath: "Events/a.md" },
			meta: {},
		});

		const { graph } = buildDependencyGraph([depEvent, preEvent], settings as any, app);
		expect(graph.get("Events/b.md")).toEqual(["Events/a.md"]);
		expect(graph.has("Events/a.md")).toBe(false); // no prereqs
	});

	it("builds eventIdMap from events", () => {
		const settings = { ...createMockSingleCalendarSettings(), prerequisiteProp: "Prerequisite" };
		const event = createMockTimedEvent({ id: "uuid-123", ref: { filePath: "Events/x.md" }, meta: {} });
		const { eventIdMap } = buildDependencyGraph([event], settings as any, makeMockApp());
		expect(eventIdMap.get("Events/x.md")).toBe("uuid-123");
	});
});

describe("getPrerequisitesOf / getDependentsOf / isConnected", () => {
	const graph = new Map([
		["Events/b.md", ["Events/a.md"]],
		["Events/c.md", ["Events/a.md", "Events/b.md"]],
	]);

	it("getPrerequisitesOf returns direct prerequisites", () => {
		expect(getPrerequisitesOf(graph, "Events/b.md")).toEqual(["Events/a.md"]);
		expect(getPrerequisitesOf(graph, "Events/a.md")).toEqual([]);
	});

	it("getDependentsOf returns events that depend on the given event", () => {
		expect(getDependentsOf(graph, "Events/a.md")).toEqual(["Events/b.md", "Events/c.md"]);
		expect(getDependentsOf(graph, "Events/c.md")).toEqual([]);
	});

	it("isConnected returns true for events with prerequisite edges", () => {
		expect(isConnected(graph, "Events/a.md")).toBe(true); // a is a prereq of b and c
		expect(isConnected(graph, "Events/b.md")).toBe(true); // b has prereqs
		expect(isConnected(graph, "Events/c.md")).toBe(true); // c has prereqs
	});

	it("isConnected returns false for events with no edges", () => {
		expect(isConnected(graph, "Events/z.md")).toBe(false);
	});
});
