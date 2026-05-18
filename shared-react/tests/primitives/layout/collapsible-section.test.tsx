import { screen } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { CollapsibleSection, SectionBody, SectionHeader } from "../../../src/primitives/layout/collapsible-section";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const PREFIX = "prisma-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

// ─── Sub-components in isolation ─────────────────────────────────────────────

describe("SectionHeader", () => {
	it("renders the label and a ▼ toggle when expanded", () => {
		renderInTheme(<SectionHeader label="Filters" collapsed={false} onToggle={vi.fn()} />);

		expect(screen.getByText("Filters")).toBeInTheDocument();
		expect(screen.getByText("▼")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("renders a ▶ toggle when collapsed", () => {
		renderInTheme(<SectionHeader label="Filters" collapsed={true} onToggle={vi.fn()} />);

		expect(screen.getByText("▶")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
	});

	it("fires onToggle on click", async () => {
		const onToggle = vi.fn();
		const { user } = renderInTheme(<SectionHeader label="Filters" collapsed={false} onToggle={onToggle} />);

		await user.click(screen.getByRole("button"));

		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it("fires onToggle on Enter and Space keypress", async () => {
		const onToggle = vi.fn();
		const { user } = renderInTheme(<SectionHeader label="Filters" collapsed={false} onToggle={onToggle} />);
		screen.getByRole("button").focus();

		await user.keyboard("{Enter}");
		await user.keyboard(" ");

		expect(onToggle).toHaveBeenCalledTimes(2);
	});

	it("renders the actions slot", () => {
		renderInTheme(
			<SectionHeader
				label="Filters"
				collapsed={false}
				onToggle={vi.fn()}
				actions={<button type="button">Reset</button>}
			/>
		);

		expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
	});
});

describe("SectionBody", () => {
	it("renders children when expanded", () => {
		renderInTheme(
			<SectionBody collapsed={false}>
				<span>body</span>
			</SectionBody>
		);
		expect(screen.getByText("body")).toBeInTheDocument();
	});

	it("applies the hidden class when collapsed", () => {
		const { container } = renderInTheme(
			<SectionBody collapsed={true}>
				<span>body</span>
			</SectionBody>
		);
		expect(container.firstElementChild).toHaveClass(`${PREFIX}collapsible-hidden`);
	});

	it("does NOT apply the hidden class when expanded", () => {
		const { container } = renderInTheme(
			<SectionBody collapsed={false}>
				<span>body</span>
			</SectionBody>
		);
		expect(container.firstElementChild).not.toHaveClass(`${PREFIX}collapsible-hidden`);
	});
});

// ─── Composition ─────────────────────────────────────────────────────────────

describe("CollapsibleSection (composition)", () => {
	it("starts expanded by default and renders children", () => {
		renderInTheme(
			<CollapsibleSection label="Filters">
				<span>body content</span>
			</CollapsibleSection>
		);

		expect(screen.getByText("body content")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("honors `defaultCollapsed` in uncontrolled mode", () => {
		renderInTheme(
			<CollapsibleSection label="Filters" defaultCollapsed>
				<span>body</span>
			</CollapsibleSection>
		);
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
	});

	it("toggles its own state in uncontrolled mode", async () => {
		const { user } = renderInTheme(
			<CollapsibleSection label="Filters">
				<span>body</span>
			</CollapsibleSection>
		);

		const header = screen.getByRole("button");
		expect(header).toHaveAttribute("aria-expanded", "true");

		await user.click(header);
		expect(header).toHaveAttribute("aria-expanded", "false");

		await user.click(header);
		expect(header).toHaveAttribute("aria-expanded", "true");
	});

	it("is fully controlled when `collapsed` is provided", async () => {
		function Harness() {
			const [collapsed, setCollapsed] = useState(false);
			return (
				<CollapsibleSection label="Filters" collapsed={collapsed} onToggle={setCollapsed}>
					<span>body</span>
				</CollapsibleSection>
			);
		}

		const { user } = renderInTheme(<Harness />);

		const header = screen.getByRole("button");
		expect(header).toHaveAttribute("aria-expanded", "true");

		await user.click(header);
		expect(header).toHaveAttribute("aria-expanded", "false");
	});

	it("fires onToggle in controlled mode without mutating internal state", async () => {
		const onToggle = vi.fn();
		const { user } = renderInTheme(
			<CollapsibleSection label="Filters" collapsed={false} onToggle={onToggle}>
				<span>body</span>
			</CollapsibleSection>
		);

		await user.click(screen.getByRole("button"));

		expect(onToggle).toHaveBeenCalledExactlyOnceWith(true);
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("renders the actions slot passed through to the header", () => {
		renderInTheme(
			<CollapsibleSection label="Filters" actions={<button type="button">Reset</button>}>
				<span>body</span>
			</CollapsibleSection>
		);

		expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
	});

	// Regression: clicking a control inside the `actions` slot must NOT toggle
	// the header. Without bubbling protection the "Add property" button in the
	// EventForm collapses the section it's supposed to expand.
	it("does NOT toggle collapse when a button inside the actions slot is clicked", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(
			<CollapsibleSection
				label="Filters"
				actions={
					<button type="button" onClick={onClick}>
						Add
					</button>
				}
			>
				<span>body</span>
			</CollapsibleSection>
		);

		// Find the toggle header (aria-expanded="true" by default).
		const header = screen.getByRole("button", { expanded: true });
		expect(header).toHaveAttribute("aria-expanded", "true");

		await user.click(screen.getByRole("button", { name: "Add" }));

		expect(onClick).toHaveBeenCalledTimes(1);
		// Header must still be expanded — the click did NOT bubble.
		expect(header).toHaveAttribute("aria-expanded", "true");
	});

	it("does NOT trigger keyboard activation when Enter is pressed on a button inside the actions slot", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(
			<CollapsibleSection
				label="Filters"
				actions={
					<button type="button" onClick={onClick}>
						Add
					</button>
				}
			>
				<span>body</span>
			</CollapsibleSection>
		);

		const header = screen.getByRole("button", { expanded: true });
		const addBtn = screen.getByRole("button", { name: "Add" });
		addBtn.focus();
		await user.keyboard("{Enter}");

		expect(onClick).toHaveBeenCalledTimes(1);
		// Header must NOT have toggled from the bubbled Enter keypress.
		expect(header).toHaveAttribute("aria-expanded", "true");
	});
});
