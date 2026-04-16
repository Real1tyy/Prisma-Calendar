import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyHint } from "../../src/components/empty-hint";
import { renderReact } from "../helpers/render-react";

describe("EmptyHint", () => {
	it("renders the provided text", () => {
		renderReact(<EmptyHint text="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeInTheDocument();
	});

	it("applies the className when provided", () => {
		const { container } = renderReact(<EmptyHint text="x" className="muted" />);
		expect(container.querySelector("span.muted")).not.toBeNull();
	});
});
