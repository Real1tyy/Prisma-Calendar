import type { CellOption } from "@real1ty-obsidian-plugins-react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CellPickerContent } from "../../src/grid-layout/cell-picker-modal";
import { renderWithProviders } from "../harness/render-with-providers";

const CSS_PREFIX = "test-";

function makePalette(ids: string[]): CellOption[] {
	return ids.map((id) => ({
		id,
		label: id.charAt(0).toUpperCase() + id.slice(1),
		render: vi.fn(),
	}));
}

function renderPicker(options: { palette?: CellOption[]; currentId?: string; usedIds?: Set<string> }) {
	const palette = options.palette ?? makePalette(["alpha", "beta", "gamma"]);
	const usedIds = options.usedIds ?? new Set<string>();
	const onSelect = vi.fn();
	const result = renderWithProviders(
		<CellPickerContent cellPalette={palette} currentId={options.currentId} usedIds={usedIds} onSelect={onSelect} />,
		{ cssPrefix: CSS_PREFIX, testIdPrefix: CSS_PREFIX }
	);
	return { ...result, onSelect, palette, usedIds };
}

describe("CellPickerContent (React parity)", () => {
	it("renders one item per palette entry", () => {
		const { container } = renderPicker({ palette: makePalette(["alpha", "beta", "gamma"]) });
		const items = container.querySelectorAll<HTMLElement>(".test-grid-picker-item");
		expect(items.length).toBe(3);
	});

	it("each item has its label text", () => {
		const { container } = renderPicker({ palette: makePalette(["alpha", "beta", "gamma"]) });
		const items = Array.from(container.querySelectorAll<HTMLElement>(".test-grid-picker-item"));
		const labels = items.map((i) => i.querySelector(".test-grid-picker-item-label")?.firstChild?.textContent?.trim());
		expect(labels).toEqual(["Alpha", "Beta", "Gamma"]);
	});

	it("each item has data-option-id set", () => {
		const { container } = renderPicker({ palette: makePalette(["alpha", "beta"]) });
		const items = Array.from(container.querySelectorAll<HTMLElement>(".test-grid-picker-item"));
		expect(items.map((i) => i.getAttribute("data-option-id"))).toEqual(["alpha", "beta"]);
	});

	it("marks current item with current class and Current badge", () => {
		const { container } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
			currentId: "alpha",
		});
		const alpha = container.querySelector<HTMLElement>('[data-option-id="alpha"]')!;
		expect(alpha.classList.contains("test-grid-picker-item-current")).toBe(true);
		const badge = alpha.querySelector(".test-grid-picker-item-badge");
		expect(badge?.textContent).toBe("Current");
	});

	it("does not mark current item as used (current takes precedence)", () => {
		const { container } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
			currentId: "alpha",
			usedIds: new Set(["alpha"]),
		});
		const alpha = container.querySelector<HTMLElement>('[data-option-id="alpha"]')!;
		expect(alpha.classList.contains("test-grid-picker-item-used")).toBe(false);
		expect(alpha.classList.contains("test-grid-picker-item-current")).toBe(true);
	});

	it("marks used items with used class and In use badge", () => {
		const { container } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
			usedIds: new Set(["alpha"]),
		});
		const alpha = container.querySelector<HTMLElement>('[data-option-id="alpha"]')!;
		const beta = container.querySelector<HTMLElement>('[data-option-id="beta"]')!;
		expect(alpha.classList.contains("test-grid-picker-item-used")).toBe(true);
		expect(beta.classList.contains("test-grid-picker-item-used")).toBe(false);
		expect(alpha.querySelector(".test-grid-picker-item-badge")?.textContent).toBe("In use");
		expect(beta.querySelector(".test-grid-picker-item-badge")).toBeNull();
	});

	it("clicking a non-current item invokes onSelect with that option id", () => {
		const { container, onSelect } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
		});
		const beta = container.querySelector<HTMLElement>('[data-option-id="beta"]')!;
		fireEvent.click(beta);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith("beta");
	});

	it("clicking the current item is a no-op", () => {
		const { container, onSelect } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
			currentId: "alpha",
		});
		const alpha = container.querySelector<HTMLElement>('[data-option-id="alpha"]')!;
		fireEvent.click(alpha);
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("clicking a used (non-current) item still invokes onSelect", () => {
		const { container, onSelect } = renderPicker({
			palette: makePalette(["alpha", "beta"]),
			usedIds: new Set(["alpha"]),
		});
		const alpha = container.querySelector<HTMLElement>('[data-option-id="alpha"]')!;
		fireEvent.click(alpha);
		expect(onSelect).toHaveBeenCalledWith("alpha");
	});

	it("renders the picker list container", () => {
		const { container } = renderPicker({});
		expect(container.querySelector(".test-grid-picker-list")).toBeTruthy();
	});
});
