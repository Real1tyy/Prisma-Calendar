import "@testing-library/jest-dom/vitest";

import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mountFilterPresetSelector } from "../../src/components/filter-preset-selector-mount";
import { createMockApp, createMockReactBundle } from "../fixtures/react-view-fixtures";

function buildToolbar(): HTMLElement {
	const container = document.createElement("div");
	const chunk = document.createElement("div");
	chunk.className = "fc-toolbar-chunk";
	const zoomBtn = document.createElement("button");
	zoomBtn.className = "fc-zoomLevel-button";
	chunk.appendChild(zoomBtn);
	container.appendChild(chunk);
	document.body.appendChild(container);
	return container;
}

describe("mountFilterPresetSelector", () => {
	it("injects the wrapper after the zoom button and renders the select", () => {
		const container = buildToolbar();
		const bundle = createMockReactBundle({
			settings: { filterPresets: [{ name: "Done", expression: "Status === 'Done'" }] } as never,
		});

		let mount: ReturnType<typeof mountFilterPresetSelector>;
		act(() => {
			mount = mountFilterPresetSelector({
				app: createMockApp(),
				bundle,
				container,
				onPresetSelected: vi.fn(),
			});
		});

		const wrapper = container.querySelector(".prisma-fc-filter-preset-wrapper");
		expect(wrapper).toBeTruthy();
		expect(wrapper?.previousElementSibling?.classList.contains("fc-zoomLevel-button")).toBe(true);
		expect(wrapper?.querySelector('[data-testid="prisma-filter-preset"]')).toBeTruthy();

		act(() => mount!.destroy());
	});

	it("focuses the rendered select when open() is called", () => {
		const container = buildToolbar();
		const bundle = createMockReactBundle({ settings: { filterPresets: [] } as never });

		let mount: ReturnType<typeof mountFilterPresetSelector>;
		act(() => {
			mount = mountFilterPresetSelector({
				app: createMockApp(),
				bundle,
				container,
				onPresetSelected: vi.fn(),
			});
		});

		const select = container.querySelector<HTMLSelectElement>(".prisma-fc-filter-preset-select");
		expect(select).toBeTruthy();
		const focusSpy = vi.spyOn(select!, "focus");

		act(() => mount!.open());

		expect(focusSpy).toHaveBeenCalled();
		act(() => mount!.destroy());
	});

	it("removes the wrapper from the DOM on destroy()", () => {
		const container = buildToolbar();
		const bundle = createMockReactBundle({ settings: { filterPresets: [] } as never });

		let mount: ReturnType<typeof mountFilterPresetSelector>;
		act(() => {
			mount = mountFilterPresetSelector({
				app: createMockApp(),
				bundle,
				container,
				onPresetSelected: vi.fn(),
			});
		});

		expect(container.querySelector(".prisma-fc-filter-preset-wrapper")).toBeTruthy();
		act(() => mount!.destroy());
		expect(container.querySelector(".prisma-fc-filter-preset-wrapper")).toBeNull();
	});
});
