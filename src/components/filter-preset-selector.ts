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

	private injectSelect(container: HTMLElement): void {
		const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
		if (!toolbarLeft) return;

		const wrapper = document.createElement("div");
		wrapper.className = "fc-filter-preset-wrapper";

		this.select = document.createElement("select");
		this.select.className = "fc-filter-preset-select";

		const clearOption = document.createElement("option");
		clearOption.value = "clear";
		clearOption.textContent = "Clear";
		this.select.appendChild(clearOption);

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
			if (this.select) {
				this.select.value = "clear";
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

		while (this.select.options.length > 1) {
			this.select.remove(1);
		}

		this.presets.forEach((preset) => {
			const option = document.createElement("option");
			option.value = preset.expression;
			option.textContent = preset.name;
			this.select?.appendChild(option);
		});

		this.select.value = "clear";
	}

	destroy(): void {
		this.select = null;
	}
}
