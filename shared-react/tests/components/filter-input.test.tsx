import { screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterInput, useFilteredItems } from "../../src/components/filter-input";
import { renderReact } from "../helpers/render-react";

describe("FilterInput", () => {
	it("renders with placeholder", () => {
		renderReact(<FilterInput value="" onChange={vi.fn()} placeholder="Search..." testId="search" />);

		expect(screen.getByTestId("search")).toHaveAttribute("placeholder", "Search...");
	});

	it("renders with initial value", () => {
		renderReact(<FilterInput value="hello" onChange={vi.fn()} testId="search" />);

		expect(screen.getByTestId("search")).toHaveValue("hello");
	});

	it("calls onChange after debounce", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<FilterInput value="" onChange={onChange} debounceMs={50} testId="search" />);

		await user.type(screen.getByTestId("search"), "abc");

		await waitFor(() => expect(onChange).toHaveBeenCalled());
	});

	it("fires onChange immediately on Enter", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<FilterInput value="" onChange={onChange} debounceMs={500} testId="search" />);

		await user.type(screen.getByTestId("search"), "test{Enter}");

		expect(onChange).toHaveBeenCalledWith("test");
	});

	it("fires onEscape when Escape pressed", async () => {
		const onEscape = vi.fn();
		const { user } = renderReact(<FilterInput value="" onChange={vi.fn()} onEscape={onEscape} testId="search" />);

		screen.getByTestId("search").focus();
		await user.keyboard("{Escape}");

		expect(onEscape).toHaveBeenCalledOnce();
	});

	it("syncs external value changes", () => {
		const { rerender } = renderReact(<FilterInput value="old" onChange={vi.fn()} testId="search" />);

		rerender(<FilterInput value="new" onChange={vi.fn()} testId="search" />);

		expect(screen.getByTestId("search")).toHaveValue("new");
	});

	describe("flushOnBlur", () => {
		it("commits the pending debounced value on blur when enabled", async () => {
			const onChange = vi.fn();
			const { user } = renderReact(
				<FilterInput value="" onChange={onChange} debounceMs={5000} flushOnBlur testId="search" />
			);

			const input = screen.getByTestId("search");
			await user.type(input, "abc");
			expect(onChange).not.toHaveBeenCalled();

			input.blur();

			expect(onChange).toHaveBeenCalledExactlyOnceWith("abc");
		});

		it("does not commit on blur when flag is omitted (default)", async () => {
			const onChange = vi.fn();
			const { user } = renderReact(<FilterInput value="" onChange={onChange} debounceMs={5000} testId="search" />);

			const input = screen.getByTestId("search");
			await user.type(input, "abc");
			input.blur();

			expect(onChange).not.toHaveBeenCalled();
		});

		it("does not commit on blur when no debounce is pending", async () => {
			const onChange = vi.fn();
			const { user } = renderReact(
				<FilterInput value="" onChange={onChange} debounceMs={50} flushOnBlur testId="search" />
			);

			const input = screen.getByTestId("search");
			await user.type(input, "a");
			await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith("a"));

			input.blur();
			expect(onChange).toHaveBeenCalledOnce();
		});

		it("trims whitespace when flushing on blur", async () => {
			const onChange = vi.fn();
			const { user } = renderReact(
				<FilterInput value="" onChange={onChange} debounceMs={5000} flushOnBlur testId="search" />
			);

			const input = screen.getByTestId("search");
			await user.type(input, "  spaced  ");
			input.blur();

			expect(onChange).toHaveBeenCalledExactlyOnceWith("spaced");
		});
	});

	describe("inputRef forwarding", () => {
		it("forwards a ref to the underlying input element", () => {
			const ref = createRef<HTMLInputElement>();
			renderReact(<FilterInput value="hello" onChange={vi.fn()} inputRef={ref} testId="search" />);

			expect(ref.current).toBeInstanceOf(HTMLInputElement);
			expect(ref.current).toBe(screen.getByTestId("search"));
		});

		it("allows the caller to detect focus via the forwarded ref", () => {
			const ref = createRef<HTMLInputElement>();
			renderReact(<FilterInput value="" onChange={vi.fn()} inputRef={ref} testId="search" />);

			expect(document.activeElement === ref.current).toBe(false);
			ref.current?.focus();
			expect(document.activeElement === ref.current).toBe(true);
		});
	});
});

describe("useFilteredItems", () => {
	interface TestItem {
		name: string;
		description: string;
	}

	const items: TestItem[] = [
		{ name: "Alpha", description: "First item" },
		{ name: "Beta", description: "Second item" },
		{ name: "Gamma", description: "Third thing" },
	];

	function HookHarness({ query, fields }: { query: string; fields: (keyof TestItem)[] }) {
		const filtered = useFilteredItems(items, query, fields);
		return (
			<ul>
				{filtered.map((item) => (
					<li key={item.name}>{item.name}</li>
				))}
			</ul>
		);
	}

	it("returns all items when query is empty", () => {
		renderReact(<HookHarness query="" fields={["name"]} />);

		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.getByText("Beta")).toBeInTheDocument();
		expect(screen.getByText("Gamma")).toBeInTheDocument();
	});

	it("filters by name field", () => {
		renderReact(<HookHarness query="alpha" fields={["name"]} />);

		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.queryByText("Beta")).not.toBeInTheDocument();
	});

	it("filters across multiple fields", () => {
		renderReact(<HookHarness query="thing" fields={["name", "description"]} />);

		expect(screen.getByText("Gamma")).toBeInTheDocument();
		expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
	});

	it("is case-insensitive", () => {
		renderReact(<HookHarness query="BETA" fields={["name"]} />);

		expect(screen.getByText("Beta")).toBeInTheDocument();
	});

	it("returns empty when no matches", () => {
		renderReact(<HookHarness query="zzz" fields={["name"]} />);

		expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
		expect(screen.queryByText("Beta")).not.toBeInTheDocument();
		expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
	});
});
