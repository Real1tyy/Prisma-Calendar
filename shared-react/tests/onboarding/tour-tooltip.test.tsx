import { screen } from "@testing-library/react";
import type { TooltipRenderProps } from "react-joyride";
import { describe, expect, it, vi } from "vitest";

import { TourTooltip } from "../../src/onboarding/tour-tooltip";
import { renderReact } from "../helpers/render-react";

function buttonProps(action: string) {
	return { "aria-label": action, "data-action": action, onClick: vi.fn(), role: "button", title: action };
}

function buildProps(overrides: Partial<TooltipRenderProps> = {}): TooltipRenderProps {
	return {
		continuous: true,
		index: 0,
		isLastStep: false,
		size: 5,
		step: { title: "Step title", content: "Step body copy" } as TooltipRenderProps["step"],
		backProps: buttonProps("back"),
		closeProps: buttonProps("close"),
		primaryProps: buttonProps("primary"),
		skipProps: buttonProps("skip"),
		tooltipProps: { "aria-modal": true, role: "dialog" } as TooltipRenderProps["tooltipProps"],
		controls: {} as TooltipRenderProps["controls"],
		...overrides,
	};
}

function renderTooltip(props: TooltipRenderProps) {
	return renderReact(<TourTooltip {...props} />, undefined, undefined, {
		cssPrefix: "prisma-",
		testIdPrefix: "prisma-",
	});
}

describe("TourTooltip", () => {
	it("renders the step title, body, and progress", () => {
		renderTooltip(buildProps());

		expect(screen.getByTestId("prisma-tour-tooltip")).toBeTruthy();
		expect(screen.getByText("Step title")).toBeTruthy();
		expect(screen.getByText("Step body copy")).toBeTruthy();
		expect(screen.getByTestId("prisma-tour-progress").textContent).toBe("1 / 5");
	});

	it("on the first step shows Skip + Next but not Back", () => {
		renderTooltip(buildProps());

		expect(screen.getByTestId("prisma-tour-skip")).toBeTruthy();
		expect(screen.getByTestId("prisma-tour-next").textContent).toBe("Next");
		expect(screen.queryByTestId("prisma-tour-back")).toBeNull();
	});

	it("on the last step shows Done and hides Skip", () => {
		renderTooltip(buildProps({ index: 4, isLastStep: true }));

		expect(screen.getByTestId("prisma-tour-next").textContent).toBe("Done");
		expect(screen.queryByTestId("prisma-tour-skip")).toBeNull();
		expect(screen.getByTestId("prisma-tour-back")).toBeTruthy();
	});

	it("wires each control to its joyride handler", async () => {
		const props = buildProps({ index: 2 });
		const { user } = renderTooltip(props);

		await user.click(screen.getByTestId("prisma-tour-next"));
		await user.click(screen.getByTestId("prisma-tour-back"));
		await user.click(screen.getByTestId("prisma-tour-skip"));
		await user.click(screen.getByTestId("prisma-tour-close"));

		expect(props.primaryProps.onClick).toHaveBeenCalledTimes(1);
		expect(props.backProps.onClick).toHaveBeenCalledTimes(1);
		expect(props.skipProps.onClick).toHaveBeenCalledTimes(1);
		expect(props.closeProps.onClick).toHaveBeenCalledTimes(1);
	});

	it("omits the progress counter for a single-step tour", () => {
		renderTooltip(buildProps({ size: 1, isLastStep: true }));

		expect(screen.queryByTestId("prisma-tour-progress")).toBeNull();
	});
});
