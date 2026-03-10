import { cls } from "@real1ty-obsidian-plugins";
import { AbstractInputSuggest, type App } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";

export type SuggestionSource = "category" | "preset" | "name-series";

export interface TitleSuggestion {
	text: string;
	source: SuggestionSource;
	frequency?: number;
}

const SUGGESTION_LIMIT = 10;

export function collectSuggestions(query: string, bundle: CalendarBundle): TitleSuggestion[] {
	if (!query.trim()) return [];

	const lowerQuery = query.toLowerCase();
	const seen = new Set<string>();
	const results: TitleSuggestion[] = [];

	const addMatches = (items: Iterable<{ text: string; key: string }>, source: SuggestionSource) => {
		for (const { text, key } of items) {
			if (key.includes(lowerQuery) && !seen.has(key)) {
				seen.add(key);
				results.push({ text, source });
			}
		}
	};

	const categories = bundle.categoryTracker.getCategories().map((cat) => ({ text: cat, key: cat.toLowerCase() }));
	addMatches(categories, "category");

	const presets = bundle.settingsStore.currentSettings.eventPresets.map((p) => ({
		text: p.name,
		key: p.name.toLowerCase(),
	}));
	addMatches(presets, "preset");

	const nameSeriesMap = bundle.nameSeriesTracker.getNameSeriesMap();
	const nameEntries: { text: string; frequency: number }[] = [];
	for (const [nameKey, filePaths] of nameSeriesMap) {
		if (nameKey.includes(lowerQuery) && !seen.has(nameKey)) {
			seen.add(nameKey);
			const firstPath = filePaths.values().next().value!;
			const title = bundle.eventStore.getEventByPath(firstPath)?.title ?? nameKey;
			nameEntries.push({ text: title, frequency: filePaths.size });
		}
	}

	nameEntries.sort((a, b) => b.frequency - a.frequency);
	for (const entry of nameEntries) {
		results.push({ text: entry.text, source: "name-series", frequency: entry.frequency });
	}

	return results.slice(0, SUGGESTION_LIMIT);
}

export class TitleInputSuggest extends AbstractInputSuggest<TitleSuggestion> {
	private bundle: CalendarBundle;
	private titleInputEl: HTMLInputElement;
	private ghostEl: HTMLSpanElement | null = null;
	private ghostPrefixEl: HTMLSpanElement | null = null;
	private ghostSuffixEl: HTMLSpanElement | null = null;
	private wrapperEl: HTMLElement | null = null;
	private currentCompletion = "";
	private hasUserTyped = false;

	constructor(app: App, inputEl: HTMLInputElement, bundle: CalendarBundle) {
		super(app, inputEl);
		this.bundle = bundle;
		this.titleInputEl = inputEl;
		this.limit = SUGGESTION_LIMIT;
		this.setupGhostText(inputEl);
		this.setupTabHandler(inputEl);

		inputEl.addEventListener("input", () => {
			this.hasUserTyped = true;
		});

		this.onSelect((value) => {
			this.setValue(value.text);
			inputEl.dispatchEvent(new Event("blur", { bubbles: true }));
		});
	}

	getSuggestions(query: string): TitleSuggestion[] {
		if (!this.hasUserTyped) return [];
		const suggestions = collectSuggestions(query, this.bundle);
		this.updateGhostText(query, suggestions);
		return suggestions;
	}

	renderSuggestion(suggestion: TitleSuggestion, el: HTMLElement): void {
		el.addClass(cls("suggest-item"));

		el.createSpan({ text: suggestion.text });

		const badge = el.createSpan({ cls: cls("suggest-source-badge") });
		if (suggestion.source === "category") {
			badge.textContent = "Category";
		} else if (suggestion.source === "preset") {
			badge.textContent = "Preset";
		} else if (suggestion.frequency !== undefined) {
			badge.textContent = `×${suggestion.frequency}`;
		}
	}

	selectSuggestion(value: TitleSuggestion, evt: MouseEvent | KeyboardEvent): void {
		super.selectSuggestion(value, evt);
	}

	private setupGhostText(inputEl: HTMLInputElement): void {
		const parent = inputEl.parentElement;
		if (!parent) return;

		this.wrapperEl = parent.createDiv(cls("title-input-wrapper"));
		inputEl.before(this.wrapperEl);
		this.wrapperEl.appendChild(inputEl);

		this.ghostEl = this.wrapperEl.createSpan(cls("title-ghost-text"));
		this.ghostPrefixEl = this.ghostEl.createSpan(cls("title-ghost-prefix"));
		this.ghostSuffixEl = this.ghostEl.createSpan(cls("title-ghost-suffix"));
	}

	private setupTabHandler(inputEl: HTMLInputElement): void {
		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Tab" && this.currentCompletion) {
				e.preventDefault();
				this.setValue(inputEl.value + this.currentCompletion);
				this.clearGhost();
			}
		});
	}

	private updateGhostText(query: string, suggestions: TitleSuggestion[]): void {
		if (!this.ghostEl || !this.ghostSuffixEl) return;

		if (!query || suggestions.length === 0) {
			this.clearGhost();
			return;
		}

		const top = suggestions[0];
		const lowerQuery = query.toLowerCase();
		const lowerText = top.text.toLowerCase();

		if (lowerText.startsWith(lowerQuery)) {
			const completion = top.text.slice(query.length);
			this.ghostSuffixEl.textContent = completion;
			this.currentCompletion = completion;
			this.positionGhost(this.titleInputEl);
		} else {
			this.clearGhost();
		}
	}

	private positionGhost(inputEl: HTMLInputElement): void {
		if (!this.ghostEl) return;

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d")!;
		const style = getComputedStyle(inputEl);
		ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
		const textWidth = ctx.measureText(inputEl.value).width;

		const inputWidth = inputEl.clientWidth;
		const paddingLeft = parseFloat(style.paddingLeft);
		const paddingRight = parseFloat(style.paddingRight);
		const availableWidth = inputWidth - paddingLeft - paddingRight;
		const textStart = paddingLeft + (availableWidth - textWidth) / 2;
		this.ghostEl.style.setProperty("--ghost-left", `${textStart + textWidth}px`);
	}

	private clearGhost(): void {
		if (this.ghostSuffixEl) this.ghostSuffixEl.textContent = "";
		this.currentCompletion = "";
	}

	close(): void {
		super.close();
		this.clearGhost();
	}

	destroy(): void {
		if (this.wrapperEl) {
			const inputEl = this.wrapperEl.querySelector("input");
			if (inputEl) {
				this.wrapperEl.before(inputEl);
			}
			this.wrapperEl.remove();
			this.ghostEl = null;
			this.ghostPrefixEl = null;
			this.ghostSuffixEl = null;
			this.wrapperEl = null;
		}
	}
}
