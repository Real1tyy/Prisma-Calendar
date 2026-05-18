import { describe, expect, it, vi } from "vitest";

import { collectSuggestions, TitleInputSuggest, type TitleSuggestion } from "../../src/components/title-input-suggest";

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

// Regression: typing "Planni" with the ghost suggesting "Planning", pressing
// Enter to accept the suggestion, then Save persisted a file named
// "Planni-<zettel>.md" — the suggester wrote "Planning" into the DOM via
// AbstractInputSuggest.setValue, but the React form controller never heard
// about it (setValue is a direct `inputEl.value = x` that React's tracker
// shim swallows), so the next submit read the typed prefix from React state.
//
// Fix: the suggester no longer touches the DOM on accept. It hands the
// chosen string to the owner via `onAcceptTitle`, and the owner (React
// Hook Form's `field.onChange`) updates the canonical form state — React
// re-renders and the controlled input picks up the new value through its
// normal `value={field.value}` binding. No native-setter trickery needed.
describe("TitleInputSuggest — onAcceptTitle hand-off", () => {
	function makeBundle(): any {
		return {
			plugin: { app: {} },
			settingsStore: { currentSettings: { eventPresets: [] } },
			categoryTracker: { getCategories: () => [] },
			nameSeriesTracker: { getNameSeriesMap: () => new Map() },
			eventStore: { getEventByPath: () => null },
		};
	}

	function inWrapper(input: HTMLInputElement): HTMLInputElement {
		// TitleInputSuggest reads inputEl.parentElement during setupGhostText.
		// Anchor the input in a parent div so construction doesn't bail out.
		const wrapper = document.createElement("div");
		wrapper.appendChild(input);
		document.body.appendChild(wrapper);
		return input;
	}

	function simulateSelect(suggest: TitleInputSuggest, suggestion: TitleSuggestion): void {
		(
			suggest as unknown as {
				selectSuggestion: (value: TitleSuggestion, evt: MouseEvent | KeyboardEvent) => void;
			}
		).selectSuggestion(suggestion, new MouseEvent("click", { bubbles: true }));
	}

	it("selecting a popup row hands the suggestion text to onAcceptTitle (not the typed prefix)", () => {
		const input = inWrapper(document.createElement("input"));
		input.value = "Planni"; // User typed prefix.

		const onAcceptTitle = vi.fn();
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle });

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		// The owner sees the full suggestion text. Without this hand-off the
		// React form state would stay at "Planni" and the next submit would
		// persist `Planni-<zettel>.md` (the original regression).
		expect(onAcceptTitle).toHaveBeenCalledTimes(1);
		expect(onAcceptTitle).toHaveBeenCalledWith("Planning");
	});

	it("Tab-completing the ghost hands the joined value to onAcceptTitle", () => {
		const input = inWrapper(document.createElement("input"));
		input.value = "Planni";

		const onAcceptTitle = vi.fn();
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle });

		// Inject the ghost completion Tab would commit. updateGhostText normally
		// sets this; do it directly to stay independent of the rendering pipeline.
		(suggest as unknown as { currentCompletion: string }).currentCompletion = "ng";

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

		expect(onAcceptTitle).toHaveBeenCalledTimes(1);
		expect(onAcceptTitle).toHaveBeenCalledWith("Planning");
	});

	it("does NOT mutate the DOM input directly — the React owner is responsible for the re-render", () => {
		// Documents the contract change: previously the suggester wrote to
		// inputEl.value via AbstractInputSuggest.setValue. That coupled the
		// class to the DOM and went around React's controlled-input tracker.
		// Now the suggester only signals; the owner handles state + DOM.
		const input = inWrapper(document.createElement("input"));
		input.value = "Planni";

		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		expect(input.value).toBe("Planni"); // Untouched — owner owns the value.
	});

	it("blurs the input after the user accepts a suggestion (no synthetic dispatchEvent)", () => {
		const input = inWrapper(document.createElement("input"));
		input.focus();
		expect(document.activeElement).toBe(input);

		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		// Real .blur(), not a fabricated `new Event("blur")` — keeps focus
		// semantics consistent and avoids subtle differences between a
		// dispatched event and an actual focus shift.
		expect(document.activeElement).not.toBe(input);
	});

	it("destroy() removes every event listener it registered (no leaked handlers)", () => {
		const input = inWrapper(document.createElement("input"));

		const onAcceptTitle = vi.fn();
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle });

		// Prime the ghost so Tab would otherwise fire onAcceptTitle.
		(suggest as unknown as { currentCompletion: string }).currentCompletion = "ng";

		suggest.destroy();

		// Post-destroy keystrokes must NOT invoke any registered handlers.
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
		input.dispatchEvent(new Event("input", { bubbles: true }));

		expect(onAcceptTitle).not.toHaveBeenCalled();
	});

	it("no-ops gracefully when no onAcceptTitle is provided (defensive)", () => {
		const input = inWrapper(document.createElement("input"));
		const suggest = new TitleInputSuggest({} as never, input, makeBundle());

		// Should not throw even though the owner registered no callback.
		expect(() => simulateSelect(suggest, { text: "Planning", source: "name-series" })).not.toThrow();
	});
});
