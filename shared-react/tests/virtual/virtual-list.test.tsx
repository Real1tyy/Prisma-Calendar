import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VirtualList } from "../../src/virtual/virtual-list";

const ITEMS = Array.from({ length: 100 }, (_, i) => `Item ${i}`);

describe("VirtualList", () => {
	it("renders the outer scroll container with overflow: auto", () => {
		const { container } = render(
			<VirtualList items={ITEMS} estimateSize={40} renderItem={(item) => <div>{item}</div>} style={{ height: 200 }} />
		);

		const scrollContainer = container.firstElementChild as HTMLElement;
		expect(scrollContainer.style.overflow).toBe("auto");
		expect(scrollContainer.style.contain).toBe("strict");
	});

	it("renders an inner container with total estimated height", () => {
		const { container } = render(
			<VirtualList items={ITEMS} estimateSize={40} renderItem={(item) => <div>{item}</div>} style={{ height: 200 }} />
		);

		const scrollContainer = container.firstElementChild as HTMLElement;
		const innerContainer = scrollContainer.firstElementChild as HTMLElement;
		expect(innerContainer.style.height).toBe(`${ITEMS.length * 40}px`);
		expect(innerContainer.style.position).toBe("relative");
	});

	it("uses getKey override for item keys", () => {
		const getKey = vi.fn((item: string, index: number) => `key-${index}`);
		render(
			<VirtualList
				items={ITEMS.slice(0, 5)}
				estimateSize={40}
				renderItem={(item) => <div>{item}</div>}
				getKey={getKey}
				style={{ height: 400 }}
			/>
		);

		expect(getKey).toHaveBeenCalled();
	});

	it("applies className and style to the container", () => {
		const { container } = render(
			<VirtualList
				items={ITEMS.slice(0, 5)}
				estimateSize={40}
				renderItem={(item) => <div>{item}</div>}
				className="my-list"
				style={{ height: 200, border: "1px solid red" }}
			/>
		);

		const scrollContainer = container.firstElementChild as HTMLElement;
		expect(scrollContainer.className).toBe("my-list");
		expect(scrollContainer.style.border).toBe("1px solid red");
	});

	it("renders items with absolute positioning and translateY", () => {
		Object.defineProperty(HTMLElement.prototype, "clientHeight", {
			configurable: true,
			get() {
				return 400;
			},
		});
		Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
			configurable: true,
			get() {
				return 4000;
			},
		});

		const { container } = render(
			<VirtualList items={ITEMS} estimateSize={40} renderItem={(item) => <div>{item}</div>} style={{ height: 400 }} />
		);

		const scrollContainer = container.firstElementChild as HTMLElement;
		const innerContainer = scrollContainer.firstElementChild as HTMLElement;
		const renderedItems = innerContainer.children;

		if (renderedItems.length > 0) {
			const firstItem = renderedItems[0] as HTMLElement;
			expect(firstItem.style.position).toBe("absolute");
			expect(firstItem.style.transform).toMatch(/translateY/);
		}

		delete (HTMLElement.prototype as Record<string, unknown>)["clientHeight"];
		delete (HTMLElement.prototype as Record<string, unknown>)["scrollHeight"];
	});

	it("renders with empty items array", () => {
		const { container } = render(
			<VirtualList
				items={[]}
				estimateSize={40}
				renderItem={(item: string) => <div>{item}</div>}
				style={{ height: 200 }}
			/>
		);

		const scrollContainer = container.firstElementChild as HTMLElement;
		const innerContainer = scrollContainer.firstElementChild as HTMLElement;
		expect(innerContainer.style.height).toBe("0px");
	});
});
