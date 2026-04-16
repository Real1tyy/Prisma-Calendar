import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { CollapsibleSection, SectionBody, SectionHeader } from "../../src/components/collapsible-section";
import { renderReact } from "../helpers/render-react";

const PREFIX = "prisma-";

// ─── Sub-components in isolation ─────────────────────────────────────────────

describe("SectionHeader", () => {
	it("renders the label and a ▼ toggle when expanded", () => {
		renderReact(<SectionHeader label="Filters" collapsed={false} onToggle={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.getByText("Filters")).toBeInTheDocument();
		expect(screen.getByText("▼")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("renders a ▶ toggle when collapsed", () => {
		renderReact(<SectionHeader label="Filters" collapsed={true} onToggle={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.getByText("▶")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
	});

	it("fires onToggle on click", async () => {
		const onToggle = vi.fn();
		const { user } = renderReact(
			<SectionHeader label="Filters" collapsed={false} onToggle={onToggle} cssPrefix={PREFIX} />
		);

		await user.click(screen.getByRole("button"));

		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it("fires onToggle on Enter and Space keypress", async () => {
		const onToggle = vi.fn();
		const { user } = renderReact(
			<SectionHeader label="Filters" collapsed={false} onToggle={onToggle} cssPrefix={PREFIX} />
		);
		screen.getByRole("button").focus();

		await user.keyboard("{Enter}");
		await user.keyboard(" ");

		expect(onToggle).toHaveBeenCalledTimes(2);
	});

	it("renders the actions slot", () => {
		renderReact(
			<SectionHeader
				label="Filters"
				collapsed={false}
				onToggle={vi.fn()}
				cssPrefix={PREFIX}
				actions={<button type="button">Reset</button>}
			/>
		);

		expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
	});
});

describe("SectionBody", () => {
	it("renders children when expanded", () => {
		renderReact(
			<SectionBody collapsed={false} cssPrefix={PREFIX}>
				<span>body</span>
			</SectionBody>
		);
		expect(screen.getByText("body")).toBeInTheDocument();
	});

	it("applies the hidden class when collapsed", () => {
		const { container } = renderReact(
			<SectionBody collapsed={true} cssPrefix={PREFIX}>
				<span>body</span>
			</SectionBody>
		);
		expect(container.firstElementChild).toHaveClass(`${PREFIX}collapsible-hidden`);
	});

	it("does NOT apply the hidden class when expanded", () => {
		const { container } = renderReact(
			<SectionBody collapsed={false} cssPrefix={PREFIX}>
				<span>body</span>
			</SectionBody>
		);
		expect(container.firstElementChild).not.toHaveClass(`${PREFIX}collapsible-hidden`);
	});
});

// ─── Composition ─────────────────────────────────────────────────────────────

describe("CollapsibleSection (composition)", () => {
	it("starts expanded by default and renders children", () => {
		renderReact(
			<CollapsibleSection label="Filters" cssPrefix={PREFIX}>
				<span>body content</span>
			</CollapsibleSection>
		);

		expect(screen.getByText("body content")).toBeInTheDocument();
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("honors `defaultCollapsed` in uncontrolled mode", () => {
		renderReact(
			<CollapsibleSection label="Filters" defaultCollapsed cssPrefix={PREFIX}>
				<span>body</span>
			</CollapsibleSection>
		);
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
	});

	it("toggles its own state in uncontrolled mode", async () => {
		const { user } = renderReact(
			<CollapsibleSection label="Filters" cssPrefix={PREFIX}>
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
				<>
					<CollapsibleSection label="Filters" cssPrefix={PREFIX} collapsed={collapsed} onToggle={setCollapsed}>
						<span>body</span>
					</CollapsibleSection>
				</>
			);
		}

		const { user } = renderReact(<Harness />);

		const header = screen.getByRole("button");
		expect(header).toHaveAttribute("aria-expanded", "true");

		await user.click(header);
		expect(header).toHaveAttribute("aria-expanded", "false");
	});

	it("fires onToggle in controlled mode without mutating internal state", async () => {
		const onToggle = vi.fn();
		const { user } = renderReact(
			<CollapsibleSection label="Filters" cssPrefix={PREFIX} collapsed={false} onToggle={onToggle}>
				<span>body</span>
			</CollapsibleSection>
		);

		await user.click(screen.getByRole("button"));

		expect(onToggle).toHaveBeenCalledExactlyOnceWith(true);
		// Parent didn't update `collapsed`, so aria-expanded stays "true".
		expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
	});

	it("renders the actions slot passed through to the header", () => {
		renderReact(
			<CollapsibleSection label="Filters" cssPrefix={PREFIX} actions={<button type="button">Reset</button>}>
				<span>body</span>
			</CollapsibleSection>
		);

		expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
	});
});
