import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PropertyItem } from "../../../src/widgets/property-row/property-item";
import { createMockApp } from "../../harness/mock-app";
import { renderWithProviders } from "../../harness/render-with-providers";

const CSS_PREFIX = "prisma-";
const SCOPE = "event-preview-prop";
const SCOPED = `${CSS_PREFIX}${SCOPE}`;

describe("PropertyItem", () => {
	it("renders the key label in the key cell", () => {
		renderWithProviders(<PropertyItem keyLabel="Category" value="Work" scope={SCOPE} />, {
			cssPrefix: CSS_PREFIX,
		});
		expect(screen.getByText("Category")).toHaveClass(`${SCOPED}-key`);
	});

	it("renders the value in the value cell", () => {
		const { container } = renderWithProviders(<PropertyItem keyLabel="Category" value="Work" scope={SCOPE} />, {
			cssPrefix: CSS_PREFIX,
		});
		const valueCell = container.querySelector(`.${SCOPED}-value`);
		expect(valueCell?.textContent).toBe("Work");
	});

	it("wraps the row in the `<scope>-item` element", () => {
		const { container } = renderWithProviders(<PropertyItem keyLabel="K" value="V" scope={SCOPE} />, {
			cssPrefix: CSS_PREFIX,
		});
		expect(container.querySelector(`.${SCOPED}-item`)).not.toBeNull();
	});

	it("renders wiki-link values as anchors with the `<scope>-value-link` class", () => {
		renderWithProviders(<PropertyItem keyLabel="Related" value="[[Some Page]]" scope={SCOPE} />, {
			cssPrefix: CSS_PREFIX,
		});
		const link = screen.getByText("Some Page");
		expect(link.tagName).toBe("A");
		expect(link).toHaveClass(`${SCOPED}-value-link`);
	});

	it("forwards onLinkClick to PropertyValue", async () => {
		const app = createMockApp();
		app.workspace.openLinkText = vi.fn();
		const onLinkClick = vi.fn();
		const { user } = renderWithProviders(
			<PropertyItem keyLabel="Related" value="[[Page]]" scope={SCOPE} onLinkClick={onLinkClick} />,
			{ app, cssPrefix: CSS_PREFIX }
		);

		await user.click(screen.getByText("Page"));

		expect(onLinkClick).toHaveBeenCalledTimes(1);
	});

	it("accepts ReactNode keyLabel (e.g. styled text)", () => {
		renderWithProviders(
			<PropertyItem keyLabel={<span data-testid="custom-key">Bold key</span>} value="V" scope={SCOPE} />,
			{ cssPrefix: CSS_PREFIX }
		);
		expect(screen.getByTestId("custom-key")).toBeInTheDocument();
	});

	it("resolves classes against the active SharedReactThemeProvider cssPrefix", () => {
		const { container } = renderWithProviders(<PropertyItem keyLabel="K" value="V" scope={SCOPE} />, {
			cssPrefix: "bases-",
		});
		expect(container.querySelector(`.bases-${SCOPE}-item`)).not.toBeNull();
		expect(container.querySelector(`.${SCOPED}-item`)).toBeNull();
	});
});
