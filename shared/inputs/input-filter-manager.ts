export type FilterChangeCallback = (filterValue: string) => void;

const DEFAULT_DEBOUNCE_MS = 150;

export interface InputFilterManagerOptions {
	placeholder: string;
	cssClass: string;
	cssPrefix: string;
	onFilterChange: FilterChangeCallback;
	initiallyVisible?: boolean;
	onHide?: () => void;
	debounceMs?: number;
}

/**
 * Abstract base class for managing input-based filters with debouncing.
 * Provides a reusable pattern for filter inputs with show/hide functionality,
 * keyboard shortcuts, and debounced updates.
 *
 * @template T - The type of data being filtered (optional, default unknown)
 *
 * @example
 * ```ts
 * class MyFilterManager extends InputFilterManager<MyDataType> {
 *   shouldInclude(data: MyDataType): boolean {
 *     const filter = this.getCurrentValue().toLowerCase();
 *     return data.name.toLowerCase().includes(filter);
 *   }
 * }
 *
 * const manager = new MyFilterManager(
 *   containerEl,
 *   {
 *     placeholder: "Filter items...",
 *     cssClass: "my-filter-input",
 *     onFilterChange: (value) => console.log("Filter changed:", value),
 *     initiallyVisible: false,
 *   }
 * );
 * ```
 */
export abstract class InputFilterManager<T> {
	protected containerEl: HTMLElement;
	protected inputEl: HTMLInputElement | null = null;
	protected debounceTimer: number | null = null;
	protected currentValue = "";
	protected persistentlyVisible = false;
	protected onHide?: () => void;
	protected readonly debounceMs: number;
	protected readonly placeholder: string;
	protected readonly cssClass: string;
	protected readonly cssPrefix: string;
	protected readonly onFilterChange: FilterChangeCallback;

	constructor(
		protected parentEl: HTMLElement,
		options: InputFilterManagerOptions
	) {
		const {
			placeholder,
			cssClass,
			cssPrefix,
			onFilterChange,
			initiallyVisible = false,
			onHide,
			debounceMs = DEFAULT_DEBOUNCE_MS,
		} = options;

		this.debounceMs = debounceMs;
		this.placeholder = placeholder;
		this.cssClass = cssClass;
		this.cssPrefix = cssPrefix;
		this.onFilterChange = onFilterChange;
		this.onHide = onHide;

		const classes = `${cssClass}-container${initiallyVisible ? "" : ` ${cssPrefix}-hidden`}`;
		this.containerEl = this.parentEl.createEl("div", {
			cls: classes,
		});

		this.render();
	}

	private render(): void {
		this.inputEl = this.containerEl.createEl("input", {
			type: "text",
			cls: this.cssClass,
			placeholder: this.placeholder,
		});

		this.inputEl.addEventListener("input", () => {
			this.handleInputChange();
		});

		this.inputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Escape") {
				// Only allow hiding if not persistently visible
				if (!this.persistentlyVisible) {
					this.hide();
				} else {
					// Just blur the input if persistently visible
					this.inputEl?.blur();
				}
			} else if (evt.key === "Enter") {
				this.applyFilterImmediately();
			}
		});
	}

	private handleInputChange(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = window.setTimeout(() => {
			this.applyFilterImmediately();
		}, this.debounceMs);
	}

	private applyFilterImmediately(): void {
		const newValue = this.inputEl?.value.trim() ?? "";

		if (newValue !== this.currentValue) {
			this.updateFilterValue(newValue);
		}
	}

	protected updateFilterValue(value: string): void {
		this.currentValue = value;
		this.onFilterChange(value);
	}

	getCurrentValue(): string {
		return this.currentValue;
	}

	show(): void {
		this.containerEl.removeClass(`${this.cssPrefix}-hidden`);
		this.inputEl?.focus();
	}

	hide(): void {
		// Don't allow hiding if persistently visible
		if (this.persistentlyVisible) {
			return;
		}

		this.containerEl.addClass(`${this.cssPrefix}-hidden`);

		if (this.inputEl) {
			this.inputEl.value = "";
		}

		this.updateFilterValue("");
		this.onHide?.();
	}

	focus(): void {
		this.inputEl?.focus();
	}

	isVisible(): boolean {
		return !this.containerEl.hasClass(`${this.cssPrefix}-hidden`);
	}

	setPersistentlyVisible(value: boolean): void {
		this.persistentlyVisible = value;

		if (value) {
			this.show();
		} else {
			this.hide();
		}
	}

	destroy(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		this.containerEl.remove();
		this.inputEl = null;
	}

	/**
	 * Abstract method that subclasses must implement to determine
	 * whether a data item should be included based on the current filter.
	 *
	 * @param data - The data item to check
	 * @returns True if the item should be included, false otherwise
	 */
	abstract shouldInclude(data: T): boolean;
}
