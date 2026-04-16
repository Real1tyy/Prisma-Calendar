import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingHeading, SettingItem } from "../../src/components/setting-item";
import { renderReact } from "../helpers/render-react";

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
});
