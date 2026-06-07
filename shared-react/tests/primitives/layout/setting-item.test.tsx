import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingHeading, SettingItem } from "../../../src/primitives/layout/setting-item";
import { renderReact } from "../../helpers/render-react";

describe("SettingItem", () => {
	it("renders name and children", () => {
		renderReact(
			<SettingItem name="Title">
				<button type="button">Action</button>
			</SettingItem>
		);

		expect(screen.getByText("Title")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
	});

	it("renders a description when provided", () => {
		renderReact(
			<SettingItem name="Title" description="What this does">
				<span>control</span>
			</SettingItem>
		);

		expect(screen.getByText("What this does")).toBeInTheDocument();
	});

	it("omits the description element when `description` is absent", () => {
		const { container } = renderReact(
			<SettingItem name="Title">
				<span>control</span>
			</SettingItem>
		);

		expect(container.querySelector(".setting-item-description")).toBeNull();
	});
});

describe("SettingHeading", () => {
	it("renders the heading name with the heading class", () => {
		const { container } = renderReact(<SettingHeading name="Section" />);

		expect(screen.getByText("Section")).toBeInTheDocument();
		expect(container.querySelector(".setting-item-heading")).not.toBeNull();
	});

	it("omits the doc link when `docHref` is absent", () => {
		const { container } = renderReact(<SettingHeading name="Section" />);

		expect(container.querySelector("a")).toBeNull();
	});

	it("renders a clickable doc link with target/rel when `docHref` is set", () => {
		renderReact(<SettingHeading name="License" docHref="https://example.com/docs/license" docTestId="lic-doc" />);

		const link = screen.getByTestId("lic-doc");
		expect(link.tagName).toBe("A");
		expect(link).toHaveTextContent("Guide ↗");
		expect(link).toHaveAttribute("href", "https://example.com/docs/license");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("aria-label", "Open documentation for License");
	});

	it("uses a custom `docLabel` when provided", () => {
		renderReact(
			<SettingHeading name="License" docHref="https://example.com" docLabel="Setup guide" docTestId="lic-doc" />
		);

		expect(screen.getByTestId("lic-doc")).toHaveTextContent("Setup guide ↗");
	});
});
