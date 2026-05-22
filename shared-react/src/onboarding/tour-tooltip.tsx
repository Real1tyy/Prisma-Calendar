import type { TooltipRenderProps } from "react-joyride";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { buildTourStyles } from "./tour.styles";

/**
 * Obsidian-native tooltip rendered for every tour step. Replaces react-joyride's
 * default popover so the copy, buttons, and progress use the host theme and carry
 * stable `data-testid`s for E2E anchoring. All navigation behaviour comes from the
 * `*Props` joyride hands us — we only own the markup and labels.
 */
export function TourTooltip({
	index,
	size,
	isLastStep,
	step,
	backProps,
	closeProps,
	primaryProps,
	skipProps,
	tooltipProps,
}: TooltipRenderProps) {
	const { cls, tid } = useScopedStyles("tour", buildTourStyles);
	const showSkip = !isLastStep;

	return (
		<div className={cls("tooltip")} data-testid={tid("tooltip")} {...tooltipProps}>
			<button className={cls("close")} data-testid={tid("close")} {...closeProps}>
				×
			</button>

			{step.title != null && <div className={cls("title")}>{step.title}</div>}
			<div className={cls("body")}>{step.content}</div>

			<div className={cls("footer")}>
				{size > 1 && (
					<span className={cls("progress")} data-testid={tid("progress")}>
						{index + 1} / {size}
					</span>
				)}
				<div className={cls("actions")}>
					{showSkip && (
						<button className={`${cls("btn")} ${cls("btn-skip")}`} data-testid={tid("skip")} {...skipProps}>
							Skip
						</button>
					)}
					{index > 0 && (
						<button className={cls("btn")} data-testid={tid("back")} {...backProps}>
							Back
						</button>
					)}
					<button className={`${cls("btn")} mod-cta`} data-testid={tid("next")} {...primaryProps}>
						{isLastStep ? "Done" : "Next"}
					</button>
				</div>
			</div>
		</div>
	);
}
