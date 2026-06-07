import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutboundLink } from "../../../src/primitives/atoms/outbound-link";
import { renderReact } from "../../helpers/render-react";

describe("OutboundLink", () => {
	it("renders an anchor with target/rel baked in and the given href + children", () => {
		renderReact(
			<OutboundLink href="https://example.com/docs" testId="doc-link">
				Docs
			</OutboundLink>
		);

		const link = screen.getByTestId("doc-link");
		expect(link.tagName).toBe("A");
		expect(link).toHaveTextContent("Docs");
		expect(link).toHaveAttribute("href", "https://example.com/docs");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
	});

	it("applies className and ariaLabel when provided", () => {
		renderReact(
			<OutboundLink href="https://example.com" className="my-link" ariaLabel="Open docs" testId="aria-link">
				↗
			</OutboundLink>
		);

		const link = screen.getByTestId("aria-link");
		expect(link).toHaveClass("my-link");
		expect(link).toHaveAttribute("aria-label", "Open docs");
	});
});
