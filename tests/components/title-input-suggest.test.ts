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

// The suggester hands the accepted value to the owner via `onAcceptTitle`
// rather than writing it onto the DOM directly — React stayed at the typed
// prefix when setValue used AbstractInputSuggest's tracker-skipping path.
describe("TitleInputSuggest — onAcceptTitle hand-off", () => {
	function makeBundle(options: { categories?: string[] } = {}): any {
		return {
			plugin: { app: {} },
			settingsStore: { currentSettings: { eventPresets: [] } },
			categoryTracker: { getCategories: () => options.categories ?? [] },
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

		expect(onAcceptTitle).toHaveBeenCalledTimes(1);
		expect(onAcceptTitle).toHaveBeenCalledWith("Planning");
	});

	it("Tab-completing the ghost hands the joined value to onAcceptTitle", () => {
		const input = inWrapper(document.createElement("input"));
		input.value = "Planni";

		const onAcceptTitle = vi.fn();
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle });

		(suggest as unknown as { currentCompletion: string }).currentCompletion = "ng";

		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));

		expect(onAcceptTitle).toHaveBeenCalledTimes(1);
		expect(onAcceptTitle).toHaveBeenCalledWith("Planning");
	});

	it("does NOT mutate the DOM input directly — the React owner is responsible for the re-render", () => {
		const input = inWrapper(document.createElement("input"));
		input.value = "Planni";

		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		expect(input.value).toBe("Planni"); // Owner owns the value.
	});

	it("keeps focus on the input after accepting a suggestion (enables double-Enter to submit)", async () => {
		const input = inWrapper(document.createElement("input"));
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });
		input.focus();
		expect(document.activeElement).toBe(input);

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		await Promise.resolve();
		expect(document.activeElement).toBe(input);
	});

	it("reclaims focus even if some intermediate code blurred the input (defensive refocus)", async () => {
		// Pins the "Obsidian's close path moved focus" scenario — without the
		// microtask refocus, Enter#2 (submit) never reaches the form.
		const input = inWrapper(document.createElement("input"));
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), {
			onAcceptTitle: () => {
				input.blur(); // simulate something blurring the input mid-flow
			},
		});
		input.focus();

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		await Promise.resolve();
		expect(document.activeElement).toBe(input);
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

	it("preserves focus across setupGhostText reparenting (autoFocus survives construction)", () => {
		// Regression: appendChild defocuses the moved element, so React's
		// autoFocus was wiped on every modal open.
		const input = inWrapper(document.createElement("input"));
		input.focus();
		expect(document.activeElement).toBe(input);

		new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });

		expect(document.activeElement).toBe(input);
	});

	it("does NOT focus the input during construction if it wasn't focused before (no focus-stealing)", () => {
		const input = inWrapper(document.createElement("input"));
		const sentinel = document.createElement("input");
		document.body.appendChild(sentinel);
		sentinel.focus();
		expect(document.activeElement).toBe(sentinel);

		new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });

		expect(document.activeElement).toBe(sentinel);
	});

	it("closes the popup after accepting a suggestion (popup can't re-suggest the just-accepted value)", () => {
		// Regression: React re-renders the input with the accepted value, the
		// popup matches it back, and the next Enter re-selects the same row
		// instead of submitting.
		const input = inWrapper(document.createElement("input"));
		const suggest = new TitleInputSuggest({} as never, input, makeBundle(), { onAcceptTitle: vi.fn() });
		const closeSpy = vi.spyOn(suggest, "close");

		simulateSelect(suggest, { text: "Planning", source: "name-series" });

		expect(closeSpy).toHaveBeenCalled();
	});

	it("resets hasUserTyped after accept so getSuggestions returns [] until the user types again", () => {
		const input = inWrapper(document.createElement("input"));
		const suggest = new TitleInputSuggest({} as never, input, makeBundle({ categories: ["Planning"] }), {
			onAcceptTitle: vi.fn(),
		});

		// Prime hasUserTyped so getSuggestions would normally return matches.
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(
			(suggest as unknown as { getSuggestions: (q: string) => TitleSuggestion[] }).getSuggestions("Plan")
		).toHaveLength(1);

		simulateSelect(suggest, { text: "Planning", source: "category" });

		// After accept, suggestions are gated off until the user types again.
		expect(
			(suggest as unknown as { getSuggestions: (q: string) => TitleSuggestion[] }).getSuggestions("Planning")
		).toHaveLength(0);

		// Simulating user typing re-arms the suggester (next character would
		// fire `input`); suggestions return.
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(
			(suggest as unknown as { getSuggestions: (q: string) => TitleSuggestion[] }).getSuggestions("Plan")
		).toHaveLength(1);
	});
});
