/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CollapsibleSectionConfig } from "../../src/components/primitives/collapsible-section";
import { renderCollapsibleSection } from "../../src/components/primitives/collapsible-section";

function createMockContainer(): HTMLElement {
	const el = document.createElement("div");
	(el as any).createDiv = (opts?: { cls?: string }) => {
		const child = document.createElement("div");
		if (opts?.cls) child.className = opts.cls;
		setupEl(child);
		el.appendChild(child);
		return child;
	};
	setupEl(el);
	return el;
}

function setupEl(el: HTMLElement): void {
	(el as any).createDiv = (opts?: { cls?: string }) => {
		const child = document.createElement("div");
		if (opts?.cls) child.className = opts.cls;
		setupEl(child);
		el.appendChild(child);
		return child;
	};
	(el as any).createSpan = (opts?: { cls?: string; text?: string }) => {
		const child = document.createElement("span");
		if (opts?.cls) child.className = opts.cls;
		if (opts?.text) child.textContent = opts.text;
		(child as any).setText = (t: string) => {
			child.textContent = t;
		};
		el.appendChild(child);
		return child;
	};
	(el as any).createEl = (tag: string, opts?: { cls?: string; text?: string }) => {
		const child = document.createElement(tag);
		if (opts?.cls) child.className = opts.cls;
		if (opts?.text) child.textContent = opts.text;
		setupEl(child);
		el.appendChild(child);
		return child;
	};
	(el as any).addClass = (cls: string) => el.classList.add(cls);
	(el as any).removeClass = (cls: string) => el.classList.remove(cls);
	(el as any).hasClass = (cls: string) => el.classList.contains(cls);
	(el as any).toggleClass = (cls: string, force?: boolean) => el.classList.toggle(cls, force);
	(el as any).setText = (t: string) => {
		el.textContent = t;
	};
}

const PREFIX = "test-";

function defaultConfig(overrides?: Partial<CollapsibleSectionConfig>): CollapsibleSectionConfig {
	return {
		cssPrefix: PREFIX,
		label: "Section",
		renderBody: vi.fn(),
		...overrides,
	};
}

function getToggleIcon(container: HTMLElement): HTMLElement | null {
	return container.querySelector(".test-collapsible-toggle");
}

function getBody(container: HTMLElement): HTMLElement | null {
	return container.querySelector(".test-collapsible-body");
}

function getHeader(container: HTMLElement): HTMLElement | null {
	return container.querySelector(".test-collapsible-header");
}

describe("renderCollapsibleSection", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createMockContainer();
	});

	describe("initial state", () => {
		it("should render expanded by default", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			expect(getToggleIcon(container)?.textContent).toBe("▼");
			expect(getBody(container)?.classList.contains("test-collapsible-hidden")).toBe(false);
			expect(handle.isCollapsed()).toBe(false);
		});

		it("should render collapsed when startCollapsed is true", () => {
			const handle = renderCollapsibleSection(container, defaultConfig({ startCollapsed: true }));

			expect(getToggleIcon(container)?.textContent).toBe("▶");
			expect(getBody(container)?.classList.contains("test-collapsible-hidden")).toBe(true);
			expect(handle.isCollapsed()).toBe(true);
		});

		it("should render the label", () => {
			renderCollapsibleSection(container, defaultConfig({ label: "My Section" }));

			const label = container.querySelector(".test-collapsible-label");
			expect(label?.textContent).toBe("My Section");
		});

		it("should call renderBody with the body element", () => {
			const renderBody = vi.fn();
			renderCollapsibleSection(container, defaultConfig({ renderBody }));

			expect(renderBody).toHaveBeenCalledOnce();
			expect(renderBody.mock.calls[0][0]).toBe(getBody(container));
		});
	});

	describe("toggle behavior", () => {
		it("should collapse on header click when expanded", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			getHeader(container)?.click();

			expect(getToggleIcon(container)?.textContent).toBe("▶");
			expect(getBody(container)?.classList.contains("test-collapsible-hidden")).toBe(true);
			expect(handle.isCollapsed()).toBe(true);
		});

		it("should expand on header click when collapsed", () => {
			const handle = renderCollapsibleSection(container, defaultConfig({ startCollapsed: true }));

			getHeader(container)?.click();

			expect(getToggleIcon(container)?.textContent).toBe("▼");
			expect(getBody(container)?.classList.contains("test-collapsible-hidden")).toBe(false);
			expect(handle.isCollapsed()).toBe(false);
		});

		it("should toggle multiple times", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			getHeader(container)?.click();
			expect(handle.isCollapsed()).toBe(true);

			getHeader(container)?.click();
			expect(handle.isCollapsed()).toBe(false);

			getHeader(container)?.click();
			expect(handle.isCollapsed()).toBe(true);
		});
	});

	describe("programmatic control", () => {
		it("should collapse via handle", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			handle.collapse();

			expect(handle.isCollapsed()).toBe(true);
			expect(getToggleIcon(container)?.textContent).toBe("▶");
		});

		it("should expand via handle", () => {
			const handle = renderCollapsibleSection(container, defaultConfig({ startCollapsed: true }));

			handle.expand();

			expect(handle.isCollapsed()).toBe(false);
			expect(getToggleIcon(container)?.textContent).toBe("▼");
		});

		it("should toggle via handle", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			handle.toggle();
			expect(handle.isCollapsed()).toBe(true);

			handle.toggle();
			expect(handle.isCollapsed()).toBe(false);
		});

		it("should return the section element", () => {
			const handle = renderCollapsibleSection(container, defaultConfig());

			expect(handle.el).toBe(container.querySelector(".test-collapsible"));
		});
	});

	describe("state persistence", () => {
		it("should read initial state from stateMap", () => {
			const stateMap = new Map([["Section", true]]);
			const handle = renderCollapsibleSection(container, defaultConfig({ stateMap }));

			expect(handle.isCollapsed()).toBe(true);
		});

		it("should update stateMap on toggle", () => {
			const stateMap = new Map<string, boolean>();
			renderCollapsibleSection(container, defaultConfig({ stateMap }));

			getHeader(container)?.click();
			expect(stateMap.get("Section")).toBe(true);

			getHeader(container)?.click();
			expect(stateMap.get("Section")).toBe(false);
		});

		it("should prefer stateMap over startCollapsed", () => {
			const stateMap = new Map([["Section", false]]);
			const handle = renderCollapsibleSection(
				container,
				defaultConfig({
					stateMap,
					startCollapsed: true,
				})
			);

			expect(handle.isCollapsed()).toBe(false);
		});
	});

	describe("header actions", () => {
		it("should call renderHeaderActions with the header element", () => {
			const renderHeaderActions = vi.fn();
			renderCollapsibleSection(container, defaultConfig({ renderHeaderActions }));

			expect(renderHeaderActions).toHaveBeenCalledOnce();
			expect(renderHeaderActions.mock.calls[0][0]).toBe(getHeader(container));
		});
	});
});
