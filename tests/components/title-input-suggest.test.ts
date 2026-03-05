import { describe, expect, it } from "vitest";
import { collectSuggestions, type TitleSuggestion } from "../../src/components/title-input-suggest";

function createMockBundle(options: {
	categories?: string[];
	presets?: { name: string }[];
	nameSeriesMap?: Map<string, Set<string>>;
	eventsByPath?: Map<string, { title: string }>;
}) {
	const { categories = [], presets = [], nameSeriesMap = new Map(), eventsByPath = new Map() } = options;

	return {
		categoryTracker: {
			getCategories: () => categories,
		},
		settingsStore: {
			currentSettings: {
				eventPresets: presets.map((p, i) => ({ id: `preset-${i}`, name: p.name })),
			},
		},
		nameSeriesTracker: {
			getNameSeriesMap: () => nameSeriesMap,
		},
		eventStore: {
			getEventByPath: (fp: string) => eventsByPath.get(fp) ?? null,
		},
	} as any;
}

describe("collectSuggestions", () => {
	it("returns empty for blank query", () => {
		const bundle = createMockBundle({ categories: ["Work"] });
		expect(collectSuggestions("", bundle)).toEqual([]);
		expect(collectSuggestions("   ", bundle)).toEqual([]);
	});

	it("returns matching categories", () => {
		const bundle = createMockBundle({ categories: ["Work", "Personal", "Workout"] });
		const results = collectSuggestions("work", bundle);
		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({ text: "Work", source: "category" });
		expect(results[1]).toEqual({ text: "Workout", source: "category" });
	});

	it("returns matching presets", () => {
		const bundle = createMockBundle({
			presets: [{ name: "Weekly Review" }, { name: "Team Meeting" }],
		});
		const results = collectSuggestions("meet", bundle);
		expect(results).toHaveLength(1);
		expect(results[0]).toEqual({ text: "Team Meeting", source: "preset" });
	});

	it("returns name-series sorted by frequency", () => {
		const nameSeriesMap = new Map<string, Set<string>>([
			["team meeting", new Set(["f1.md", "f2.md", "f3.md"])],
			["team lunch", new Set(["f4.md", "f5.md"])],
		]);
		const eventsByPath = new Map([
			["f1.md", { title: "Team Meeting" }],
			["f4.md", { title: "Team Lunch" }],
		]);
		const bundle = createMockBundle({ nameSeriesMap, eventsByPath });

		const results = collectSuggestions("team", bundle);
		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({ text: "Team Meeting", source: "name-series", frequency: 3 });
		expect(results[1]).toEqual({ text: "Team Lunch", source: "name-series", frequency: 2 });
	});

	it("deduplicates across sources (category wins over name-series)", () => {
		const nameSeriesMap = new Map<string, Set<string>>([["work", new Set(["f1.md", "f2.md"])]]);
		const eventsByPath = new Map([["f1.md", { title: "Work" }]]);
		const bundle = createMockBundle({
			categories: ["Work"],
			nameSeriesMap,
			eventsByPath,
		});

		const results = collectSuggestions("work", bundle);
		expect(results).toHaveLength(1);
		expect(results[0].source).toBe("category");
	});

	it("deduplicates across sources (preset wins over name-series)", () => {
		const nameSeriesMap = new Map<string, Set<string>>([["weekly review", new Set(["f1.md"])]]);
		const eventsByPath = new Map([["f1.md", { title: "Weekly Review" }]]);
		const bundle = createMockBundle({
			presets: [{ name: "Weekly Review" }],
			nameSeriesMap,
			eventsByPath,
		});

		const results = collectSuggestions("weekly", bundle);
		expect(results).toHaveLength(1);
		expect(results[0].source).toBe("preset");
	});

	it("respects the limit of 10", () => {
		const categories = Array.from({ length: 15 }, (_, i) => `Category ${i}`);
		const bundle = createMockBundle({ categories });

		const results = collectSuggestions("category", bundle);
		expect(results).toHaveLength(10);
	});

	it("case-insensitive substring matching", () => {
		const bundle = createMockBundle({ categories: ["Project Planning", "Personal"] });
		const results = collectSuggestions("PLAN", bundle);
		expect(results).toHaveLength(1);
		expect(results[0].text).toBe("Project Planning");
	});

	it("resolves original title from event store for name-series", () => {
		const nameSeriesMap = new Map<string, Set<string>>([["daily standup", new Set(["f1.md", "f2.md"])]]);
		const eventsByPath = new Map([["f1.md", { title: "Daily Standup" }]]);
		const bundle = createMockBundle({ nameSeriesMap, eventsByPath });

		const results = collectSuggestions("standup", bundle);
		expect(results[0].text).toBe("Daily Standup");
	});

	it("falls back to lowercase key when no event found", () => {
		const nameSeriesMap = new Map<string, Set<string>>([["orphan event", new Set(["missing.md"])]]);
		const bundle = createMockBundle({ nameSeriesMap });

		const results = collectSuggestions("orphan", bundle);
		expect(results[0].text).toBe("orphan event");
	});

	it("preserves priority order: categories > presets > name-series", () => {
		const nameSeriesMap = new Map<string, Set<string>>([["fitness session", new Set(["f1.md"])]]);
		const eventsByPath = new Map([["f1.md", { title: "Fitness Session" }]]);
		const bundle = createMockBundle({
			categories: ["Fitness"],
			presets: [{ name: "Fitness Plan" }],
			nameSeriesMap,
			eventsByPath,
		});

		const results = collectSuggestions("fit", bundle);
		const sources = results.map((r: TitleSuggestion) => r.source);
		expect(sources).toEqual(["category", "preset", "name-series"]);
	});
});
