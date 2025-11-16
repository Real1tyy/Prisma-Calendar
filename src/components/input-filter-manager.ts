import type { Calendar } from "@fullcalendar/core";

export type FilterChangeCallback = () => void;

const DEFAULT_DEBOUNCE_MS = 150;

export abstract class InputFilterManager {
	protected input: HTMLInputElement | null = null;
	protected currentFilterValue = "";
	private debounceTimer: NodeJS.Timeout | null = null;
	private debounceMs: number;

	constructor(
		protected onFilterChange: FilterChangeCallback,
		protected placeholder: string,
		protected cssClass: string,
		debounceMs: number = DEFAULT_DEBOUNCE_MS
	) {
		this.debounceMs = debounceMs;
	}

	initialize(_calendar: Calendar, container: HTMLElement): void {
		setTimeout(() => {
			this.injectInput(container);
		}, 100);
	}

	getCurrentFilterValue(): string {
		return this.currentFilterValue;
	}

	setFilterValue(value: string): void {
		if (this.input) {
			this.input.value = value;
		}
		this.updateFilterValue(value);
	}

	focus(): void {
		this.input?.focus();
	}

	abstract shouldInclude(data: any): boolean;

	private injectInput(container: HTMLElement): void {
		const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
		if (!toolbarLeft) return;

		const wrapper = document.createElement("div");
		wrapper.className = "prisma-fc-filter-wrapper";

		this.input = document.createElement("input");
		this.input.type = "text";
		this.input.placeholder = this.placeholder;
		this.input.className = this.cssClass;

		this.input.addEventListener("input", () => {
			this.handleInputChange();
		});

		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this.handleImmediateFilter();
			}
		});

		this.input.addEventListener("blur", () => {
			this.handleImmediateFilter();
		});

		wrapper.appendChild(this.input);

		const zoomButton = toolbarLeft.querySelector(".fc-zoomLevel-button");
		if (zoomButton?.parentNode) {
			zoomButton.parentNode.insertBefore(wrapper, zoomButton.nextSibling);
		} else {
			toolbarLeft.appendChild(wrapper);
		}
	}

	private handleInputChange(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.handleImmediateFilter();
		}, this.debounceMs);
	}

	private handleImmediateFilter(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		const newFilterValue = (this.input?.value || "").trim();
		if (newFilterValue !== this.currentFilterValue) {
			this.updateFilterValue(newFilterValue);
		}
	}

	protected updateFilterValue(filterValue: string): void {
		this.currentFilterValue = filterValue;
		this.onFilterChange();
	}

	destroy(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.input = null;
	}
}
