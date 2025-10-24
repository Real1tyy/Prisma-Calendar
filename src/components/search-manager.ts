import type { Calendar } from "@fullcalendar/core";

export type SearchChangeCallback = (searchTerm: string) => void;

const DEBOUNCE_MS = 150;

export class SearchManager {
	private searchInput: HTMLInputElement | null = null;
	private currentSearchTerm = "";
	private debounceTimer: NodeJS.Timeout | null = null;

	constructor(private onSearchChange: SearchChangeCallback) {}

	initialize(_calendar: Calendar, container: HTMLElement): void {
		// Wait for toolbar to be rendered
		setTimeout(() => {
			this.injectSearchInput(container);
		}, 100);
	}

	getCurrentSearchTerm(): string {
		return this.currentSearchTerm;
	}

	focus(): void {
		this.searchInput?.focus();
	}

	private injectSearchInput(container: HTMLElement): void {
		// Find the toolbar's left section (where zoom and other buttons are)
		const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
		if (!toolbarLeft) return;

		// Create search input wrapper
		const searchWrapper = document.createElement("div");
		searchWrapper.className = "fc-search-wrapper";

		// Create search input
		this.searchInput = document.createElement("input");
		this.searchInput.type = "text";
		this.searchInput.placeholder = "Search events...";
		this.searchInput.className = "fc-search-input";

		// Handle input with debounce
		this.searchInput.addEventListener("input", () => {
			this.handleInputChange();
		});

		// Handle Enter key
		this.searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.handleImmediateSearch();
			}
		});

		// Handle blur (when input loses focus)
		this.searchInput.addEventListener("blur", () => {
			this.handleImmediateSearch();
		});

		searchWrapper.appendChild(this.searchInput);

		// Insert after zoom button
		const zoomButton = toolbarLeft.querySelector(".fc-zoomLevel-button");
		if (zoomButton?.parentNode) {
			zoomButton.parentNode.insertBefore(searchWrapper, zoomButton.nextSibling);
		} else {
			// Fallback: append to toolbar left
			toolbarLeft.appendChild(searchWrapper);
		}
	}

	private handleInputChange(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.handleImmediateSearch();
		}, DEBOUNCE_MS);
	}

	private handleImmediateSearch(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		const newSearchTerm = (this.searchInput?.value || "").trim().toLowerCase();
		if (newSearchTerm !== this.currentSearchTerm) {
			this.updateSearchTerm(newSearchTerm);
		}
	}

	private updateSearchTerm(searchTerm: string): void {
		this.currentSearchTerm = searchTerm;
		this.onSearchChange(searchTerm);
	}

	destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.searchInput = null;
	}

	matchesSearch(title: string): boolean {
		if (!this.currentSearchTerm) return true;
		return title.toLowerCase().includes(this.currentSearchTerm);
	}
}
