import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { OutboundLink } from "../../../src/primitives/atoms/outbound-link";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const PREFIX = "test-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("OutboundLink", () => {
	it("renders an anchor with target/rel baked in and the given href + children", () => {
		renderInTheme(
			<OutboundLink href="https://example.com/docs" testId="doc-link">
				Docs
			</OutboundLink>
		);

		const link = screen.getByTestId(`${PREFIX}doc-link`);
		expect(link.tagName).toBe("A");
		expect(link).toHaveTextContent("Docs");
		expect(link).toHaveAttribute("href", "https://example.com/docs");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("applies className and ariaLabel when provided", () => {
		renderInTheme(
			<OutboundLink href="https://example.com" className="my-link" ariaLabel="Open docs" testId="aria-link">
				↗
			</OutboundLink>
		);

		const link = screen.getByTestId(`${PREFIX}aria-link`);
		expect(link).toHaveClass("my-link");
		expect(link).toHaveAttribute("aria-label", "Open docs");
	});
});
