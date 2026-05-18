import { AbstractInputSuggest, type App } from "obsidian";

import { cls, tid } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";

type Dispose = () => void;

export interface TitleInputSuggestOptions {
	/**
	 * Required hand-off back to the owner when the user accepts a suggestion
	 * (Enter / click / Tab on the ghost). The owner is responsible for the
	 * actual state mutation — for React-controlled inputs that means
	 * `field.onChange(title)`. Without a callback the suggester only updates
	 * the popup; the input itself is untouched, so this is effectively
	 * required for every real use.
	 */
	onAcceptTitle?: (title: string) => void;
}

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

/**
 * Adds the listener and returns its removal as a single function. Used by
 * TitleInputSuggest so every listener it attaches survives in a `disposers`
 * array — destroy() can then tear them all down without name-tracking each
 * handler reference.
 */
function listen<K extends keyof HTMLElementEventMap>(
	el: HTMLElement,
	type: K,
	handler: (event: HTMLElementEventMap[K]) => void
): Dispose {
	el.addEventListener(type, handler as EventListener);
	return () => el.removeEventListener(type, handler as EventListener);
}

export class TitleInputSuggest extends AbstractInputSuggest<TitleSuggestion> {
	private readonly disposers: Dispose[] = [];

	private bundle: CalendarBundle;
	private titleInputEl: HTMLInputElement;
	private options: TitleInputSuggestOptions;

	private ghostEl: HTMLSpanElement | null = null;
	private ghostSuffixEl: HTMLSpanElement | null = null;
	private wrapperEl: HTMLElement | null = null;

	private currentCompletion = "";
	private hasUserTyped = false;
	private measureCtx: CanvasRenderingContext2D | null = null;

	constructor(app: App, inputEl: HTMLInputElement, bundle: CalendarBundle, options: TitleInputSuggestOptions = {}) {
		super(app, inputEl);
		this.bundle = bundle;
		this.titleInputEl = inputEl;
		this.options = options;
		this.limit = SUGGESTION_LIMIT;

		this.setupGhostText(inputEl);

		this.disposers.push(
			listen(inputEl, "input", () => {
				this.hasUserTyped = true;
			})
		);

		this.disposers.push(
			listen(inputEl, "keydown", (event) => {
				if (event.key !== "Tab" || !this.currentCompletion) return;
				event.preventDefault();
				this.acceptTitle(inputEl.value + this.currentCompletion);
			})
		);

		this.onSelect((suggestion) => {
			this.acceptTitle(suggestion.text);
			inputEl.blur();
		});
	}

	override getSuggestions(query: string): TitleSuggestion[] {
		if (!this.hasUserTyped) return [];
		const suggestions = collectSuggestions(query, this.bundle);
		this.updateGhostText(query, suggestions);
		return suggestions;
	}

	override renderSuggestion(suggestion: TitleSuggestion, el: HTMLElement): void {
		el.addClass(cls("suggest-item"));
		el.setAttribute("data-testid", tid("title-suggest-item"));
		el.setAttribute("data-suggest-source", suggestion.source);
		el.setAttribute("data-suggest-text", suggestion.text);

		el.createSpan({ text: suggestion.text });

		const badge = el.createSpan({ cls: cls("suggest-source-badge") });
		badge.textContent = getSuggestionBadge(suggestion);
	}

	/**
	 * Single hand-off path for every "user picked a title" event (Enter on a
	 * popup row, click on a row, Tab on the ghost). Hands the chosen value
	 * to the owner via `onAcceptTitle` and clears the ghost. The owner is
	 * responsible for syncing the input's actual value — for React-controlled
	 * inputs that's `field.onChange(title)`, which triggers a re-render that
	 * pushes the new value into the DOM through the normal React tracker.
	 */
	private acceptTitle(title: string): void {
		this.clearGhost();
		this.options.onAcceptTitle?.(title);
	}

	private setupGhostText(inputEl: HTMLInputElement): void {
		const parent = inputEl.parentElement;
		if (!parent) return;

		this.wrapperEl = parent.createDiv(cls("title-input-wrapper"));
		inputEl.before(this.wrapperEl);
		this.wrapperEl.appendChild(inputEl);

		this.ghostEl = this.wrapperEl.createSpan(cls("title-ghost-text"));
		this.ghostEl.createSpan(cls("title-ghost-prefix"));
		this.ghostSuffixEl = this.ghostEl.createSpan(cls("title-ghost-suffix"));
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

	// One canvas context lives for the lifetime of the suggester — measuring
	// text on every keystroke against a freshly-created canvas was wasteful
	// and let the GC reclaim a context per ghost render.
	private getMeasureCtx(): CanvasRenderingContext2D | null {
		if (this.measureCtx) return this.measureCtx;
		const canvas = this.titleInputEl.ownerDocument.createElement("canvas");
		this.measureCtx = canvas.getContext("2d");
		return this.measureCtx;
	}

	private positionGhost(inputEl: HTMLInputElement): void {
		if (!this.ghostEl) return;

		const ctx = this.getMeasureCtx();
		if (!ctx) return;

		const style = getComputedStyle(inputEl);
		ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

		const textWidth = ctx.measureText(inputEl.value).width;
		const inputWidth = inputEl.clientWidth;
		const paddingLeft = parseFloat(style.paddingLeft) || 0;
		const paddingRight = parseFloat(style.paddingRight) || 0;
		const availableWidth = inputWidth - paddingLeft - paddingRight;
		const textStart = paddingLeft + (availableWidth - textWidth) / 2;
		this.ghostEl.style.setProperty("--ghost-left", `${textStart + textWidth}px`);
	}

	private clearGhost(): void {
		if (this.ghostSuffixEl) this.ghostSuffixEl.textContent = "";
		this.currentCompletion = "";
	}

	override close(): void {
		super.close();
		this.clearGhost();
	}

	destroy(): void {
		for (const dispose of this.disposers.splice(0)) {
			dispose();
		}

		this.clearGhost();

		if (this.wrapperEl) {
			const inputEl = this.wrapperEl.querySelector("input");
			if (inputEl) {
				this.wrapperEl.before(inputEl);
			}
			this.wrapperEl.remove();
		}

		this.ghostEl = null;
		this.ghostSuffixEl = null;
		this.wrapperEl = null;
		this.measureCtx = null;
	}
}

function getSuggestionBadge(suggestion: TitleSuggestion): string {
	switch (suggestion.source) {
		case "category":
			return "Category";
		case "preset":
			return "Preset";
		case "name-series":
			return suggestion.frequency === undefined ? "" : `×${suggestion.frequency}`;
	}
}
