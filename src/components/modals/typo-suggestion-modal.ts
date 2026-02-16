import { cls } from "@real1ty-obsidian-plugins";
import { type App, SuggestModal } from "obsidian";
import type { FuzzyNameMatch } from "../../utils/calendar-events";

export class TypoSuggestionModal extends SuggestModal<FuzzyNameMatch> {
	private suggestions: FuzzyNameMatch[];
	private onAccept: (suggestion: string) => void;

	constructor(app: App, suggestions: FuzzyNameMatch[], onAccept: (suggestion: string) => void) {
		super(app);
		this.suggestions = suggestions;
		this.onAccept = onAccept;
		this.setPlaceholder("Did you mean…");
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "accept" },
			{ command: "esc", purpose: "dismiss" },
		]);
	}

	getSuggestions(): FuzzyNameMatch[] {
		return this.suggestions;
	}

	renderSuggestion(match: FuzzyNameMatch, el: HTMLElement): void {
		el.createEl("div", {
			text: match.suggestion,
			cls: cls("typo-suggestion-item-name"),
		});
		el.createEl("small", {
			text: `${Math.round(match.score * 100)}% match`,
			cls: cls("typo-suggestion-item-score"),
		});
	}

	onChooseSuggestion(match: FuzzyNameMatch): void {
		// eslint-disable-next-line no-console
		console.debug("[Prisma] TypoSuggestionModal: accepted suggestion", match.suggestion);
		this.onAccept(match.suggestion);
	}
}
