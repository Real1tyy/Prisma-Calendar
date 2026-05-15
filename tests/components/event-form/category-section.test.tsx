import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
	CategorySection,
	ParticipantSection,
	PrerequisiteSection,
} from "../../../src/react/event-form/sections/category-section";

describe("CategorySection", () => {
	it("renders one chip per category", () => {
		const colors = new Map([
			["Work", "#ff0000"],
			["Personal", "#00ff00"],
		]);
		render(
			<CategorySection
				categories={["Work", "Personal"]}
				onChange={vi.fn()}
				categoryColors={colors}
				defaultColor="#777"
				onAssign={vi.fn()}
			/>
		);
		expect(screen.getByText("Work")).toBeTruthy();
		expect(screen.getByText("Personal")).toBeTruthy();
	});

	it("invokes onAssign when the assign button is clicked", async () => {
		const onAssign = vi.fn();
		render(
			<CategorySection
				categories={[]}
				onChange={vi.fn()}
				categoryColors={new Map()}
				defaultColor="#777"
				onAssign={onAssign}
			/>
		);
		const user = userEvent.setup();
		await user.click(screen.getByTestId("prisma-event-btn-assign-categories"));
		expect(onAssign).toHaveBeenCalledTimes(1);
	});

	it("invokes onCategoryClick with the category name when a chip is clicked", async () => {
		const onCategoryClick = vi.fn();
		render(
			<CategorySection
				categories={["Work"]}
				onChange={vi.fn()}
				categoryColors={new Map([["Work", "#abc"]])}
				defaultColor="#777"
				onAssign={vi.fn()}
				onCategoryClick={onCategoryClick}
			/>
		);
		const user = userEvent.setup();
		await user.click(screen.getByText("Work"));
		expect(onCategoryClick).toHaveBeenCalledWith("Work");
	});

	it("renders the empty placeholder when categories is empty", () => {
		render(
			<CategorySection
				categories={[]}
				onChange={vi.fn()}
				categoryColors={new Map()}
				defaultColor="#777"
				onAssign={vi.fn()}
			/>
		);
		expect(screen.getByText("No categories")).toBeTruthy();
	});
});

describe("PrerequisiteSection", () => {
	it("invokes onAssign when the assign button is clicked", async () => {
		const onAssign = vi.fn();
		render(
			<PrerequisiteSection
				prerequisites={["[[Plan.md]]"]}
				onChange={vi.fn()}
				getDisplayName={(s) => s.replace(/^\[\[|\.md\]\]$/g, "")}
				onAssign={onAssign}
			/>
		);
		const user = userEvent.setup();
		await user.click(screen.getByTestId("prisma-event-btn-assign-prerequisites"));
		expect(onAssign).toHaveBeenCalledTimes(1);
	});

	it("renders chips through the supplied getDisplayName", () => {
		render(
			<PrerequisiteSection
				prerequisites={["[[Plan.md]]"]}
				onChange={vi.fn()}
				getDisplayName={(s) => s.replace(/^\[\[|\.md\]\]$/g, "")}
				onAssign={vi.fn()}
			/>
		);
		expect(screen.getByText("Plan")).toBeTruthy();
	});
});

describe("ParticipantSection", () => {
	it("adds a typed value via Enter on the participant input", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<ParticipantSection participants={[]} onChange={onChange} getDisplayName={(s) => s} />);

		const input = screen.getByTestId("prisma-event-control-participants") as HTMLInputElement;
		await user.type(input, "Alice{enter}");

		expect(onChange).toHaveBeenCalledWith(["Alice"]);
	});

	it("adds a typed value when the Add button is clicked", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<ParticipantSection participants={["Bob"]} onChange={onChange} getDisplayName={(s) => s} />);

		const input = screen.getByTestId("prisma-event-control-participants") as HTMLInputElement;
		await user.type(input, "Charlie");
		await user.click(screen.getByTestId("prisma-event-btn-add-participant"));

		expect(onChange).toHaveBeenCalledWith(["Bob", "Charlie"]);
	});

	it("ignores blank values on add", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();
		render(<ParticipantSection participants={[]} onChange={onChange} getDisplayName={(s) => s} />);

		const input = screen.getByTestId("prisma-event-control-participants") as HTMLInputElement;
		await user.type(input, "   {enter}");

		expect(onChange).not.toHaveBeenCalled();
	});

	it("clears the input after add", async () => {
		const user = userEvent.setup();
		render(<ParticipantSection participants={[]} onChange={vi.fn()} getDisplayName={(s) => s} />);

		const input = screen.getByTestId("prisma-event-control-participants") as HTMLInputElement;
		await user.type(input, "Alice{enter}");
		expect(input.value).toBe("");
	});

	it("renders existing participants via the supplied getDisplayName", () => {
		render(
			<ParticipantSection
				participants={["[[Alice]]", "Bob"]}
				onChange={vi.fn()}
				getDisplayName={(s) => s.replace(/^\[\[|\]\]$/g, "")}
			/>
		);
		const chipContainer = screen.getByTestId("prisma-event-field-participants");
		expect(within(chipContainer).getByText("Alice")).toBeTruthy();
		expect(within(chipContainer).getByText("Bob")).toBeTruthy();
	});
});
