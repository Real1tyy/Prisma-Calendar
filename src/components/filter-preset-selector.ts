import type { Calendar } from "@fullcalendar/core";
import type { FilterPreset } from "../types/settings";

export class FilterPresetSelector {
	private select: HTMLSelectElement | null = null;

	constructor(
		private presets: FilterPreset[],
		private onPresetSelected: (expression: string) => void
	) {}

	initialize(_calendar: Calendar, container: HTMLElement): void {
		setTimeout(() => {
			this.injectSelect(container);
		}, 100);
	}

	updatePresets(presets: FilterPreset[]): void {
		this.presets = presets;
		if (this.select) {
			this.rebuildSelectOptions();
		}
	}

	open(): void {
		if (!this.select) return;

		// Focus the select element
		this.select.focus();

		// Use showPicker() if available (modern browsers)
		if ("showPicker" in this.select) {
			try {
				(this.select as any).showPicker();
			} catch (_error) {
				// Fallback if showPicker fails
				this.triggerDropdownOpen();
			}
		} else {
			// Fallback for older browsers
			this.triggerDropdownOpen();
		}
	}

	private triggerDropdownOpen(): void {
		if (!this.select) return;

		// Create and dispatch a mousedown event to open the dropdown
		const event = new MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			view: window,
		});
		this.select.dispatchEvent(event);
	}

	private injectSelect(container: HTMLElement): void {
		const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
		if (!toolbarLeft) return;

		const wrapper = document.createElement("div");
		wrapper.className = "fc-filter-preset-wrapper";

		this.select = document.createElement("select");
		this.select.className = "fc-filter-preset-select fc-button fc-button-primary";

		// Hidden placeholder option that shows the arrow
		const placeholderOption = document.createElement("option");
		placeholderOption.value = "";
		placeholderOption.textContent = "▼";
		placeholderOption.disabled = true;
		placeholderOption.selected = true;
		placeholderOption.hidden = true;
		this.select.appendChild(placeholderOption);

		// Clear option
		const clearOption = document.createElement("option");
		clearOption.value = "clear";
		clearOption.textContent = "Clear";
		this.select.appendChild(clearOption);

		// User presets
		this.presets.forEach((preset) => {
			const option = document.createElement("option");
			option.value = preset.expression;
			option.textContent = preset.name;
			this.select?.appendChild(option);
		});

		this.select.addEventListener("change", () => {
			const value = this.select?.value || "";
			if (value === "clear") {
				this.onPresetSelected("");
			} else if (value) {
				this.onPresetSelected(value);
			}
			// Reset to placeholder after selection
			if (this.select) {
				this.select.selectedIndex = 0;
			}
		});

		wrapper.appendChild(this.select);

		const zoomButton = toolbarLeft.querySelector(".fc-zoomLevel-button");
		if (zoomButton?.parentNode) {
			zoomButton.parentNode.insertBefore(wrapper, zoomButton.nextSibling);
		} else {
			toolbarLeft.appendChild(wrapper);
		}
	}

	private rebuildSelectOptions(): void {
		if (!this.select) return;

		// Remove all options except placeholder and clear
		while (this.select.options.length > 2) {
			this.select.remove(2);
		}

		// Add user presets
		this.presets.forEach((preset) => {
			const option = document.createElement("option");
			option.value = preset.expression;
			option.textContent = preset.name;
			this.select?.appendChild(option);
		});

		// Reset to placeholder
		this.select.selectedIndex = 0;
	}

	destroy(): void {
		this.select = null;
	}
}
