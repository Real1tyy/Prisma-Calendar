import { cls } from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../core/calendar-bundle";
import type { CalendarEvent } from "../types/calendar";
import type { FilterPreset } from "../types/settings";
import { createExpressionMatcher, matchesSearch } from "../utils/filter-logic";

const SEARCH_DEBOUNCE_MS = 150;
const EXPRESSION_DEBOUNCE_MS = 50;

export interface ViewFilterBarHandle {
	el: HTMLElement;
	destroy: () => void;
	shouldInclude: (event: CalendarEvent) => boolean;
	filterEvents: (events: CalendarEvent[]) => FilterResult;
}

export interface FilterResult {
	visible: CalendarEvent[];
	filteredCount: number;
}

export function createViewFilterBar(bundle: CalendarBundle, onFilterChange: () => void): ViewFilterBarHandle {
	let searchValue = "";
	let expressionValue = "";
	const matcher = createExpressionMatcher(() => expressionValue);

	const barEl = document.createElement("div");
	barEl.className = cls("view-filter-bar");

	const presetWrapper = barEl.createDiv({ cls: cls("fc-filter-preset-wrapper") });
	const presetSelect = presetWrapper.createEl("select", {
		cls: cls("fc-filter-preset-select"),
	});

	const expressionInput = barEl.createEl("input", {
		type: "text",
		placeholder: "Status === 'Done'",
		cls: cls("fc-expression-input"),
	});

	const searchInput = barEl.createEl("input", {
		type: "text",
		placeholder: "Search events...",
		cls: cls("fc-search-input"),
	});

	function buildPresetOptions(presets: FilterPreset[]): void {
		presetSelect.empty();

		const placeholder = presetSelect.createEl("option", { value: "", text: "\u25BC" });
		placeholder.disabled = true;
		placeholder.selected = true;
		placeholder.hidden = true;

		presetSelect.createEl("option", { value: "clear", text: "Clear" });

		for (const preset of presets) {
			presetSelect.createEl("option", { value: preset.expression, text: preset.name });
		}
	}

	buildPresetOptions(bundle.settingsStore.currentSettings.filterPresets);

	function setExpressionValue(value: string): void {
		expressionValue = value;
		matcher.invalidate();
	}

	function createDebouncedHandler(
		input: HTMLInputElement,
		debounceMs: number,
		apply: (value: string) => void
	): { debounced: () => void; immediate: () => void } {
		let timer: ReturnType<typeof setTimeout> | null = null;

		function flush(): void {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			apply(input.value.trim());
		}

		return {
			debounced: () => {
				if (timer) clearTimeout(timer);
				timer = setTimeout(() => {
					timer = null;
					apply(input.value.trim());
				}, debounceMs);
			},
			immediate: flush,
		};
	}

	const searchHandler = createDebouncedHandler(searchInput, SEARCH_DEBOUNCE_MS, (val) => {
		if (val !== searchValue) {
			searchValue = val;
			onFilterChange();
		}
	});

	const expressionHandler = createDebouncedHandler(expressionInput, EXPRESSION_DEBOUNCE_MS, (val) => {
		if (val !== expressionValue) {
			setExpressionValue(val);
			onFilterChange();
		}
	});

	searchInput.addEventListener("input", searchHandler.debounced);
	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") searchHandler.immediate();
	});
	searchInput.addEventListener("blur", searchHandler.immediate);

	expressionInput.addEventListener("input", expressionHandler.debounced);
	expressionInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") expressionHandler.immediate();
	});
	expressionInput.addEventListener("blur", expressionHandler.immediate);

	presetSelect.addEventListener("change", () => {
		const value = presetSelect.value;
		if (value === "clear") {
			expressionInput.value = "";
			setExpressionValue("");
			onFilterChange();
		} else if (value) {
			expressionInput.value = value;
			setExpressionValue(value);
			onFilterChange();
		}
		presetSelect.selectedIndex = 0;
	});

	const settingsSub = bundle.settingsStore.settings$.subscribe((settings) => {
		buildPresetOptions(settings.filterPresets);
	});

	function shouldInclude(event: CalendarEvent): boolean {
		return matchesSearch(searchValue, { title: event.title }) && matcher.evaluate(event.meta ?? {});
	}

	function filterEvents(events: CalendarEvent[]): FilterResult {
		if (!searchValue && !expressionValue) {
			return { visible: events, filteredCount: 0 };
		}

		const visible = events.filter(shouldInclude);
		return { visible, filteredCount: events.length - visible.length };
	}

	function destroy(): void {
		searchHandler.immediate();
		expressionHandler.immediate();
		settingsSub.unsubscribe();
		barEl.remove();
	}

	return { el: barEl, destroy, shouldInclude, filterEvents };
}
