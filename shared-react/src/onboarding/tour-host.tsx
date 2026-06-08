import { StrictMode, useMemo, useRef, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ACTIONS, ORIGIN, STATUS, useJoyride, type Step } from "react-joyride";

import { AppContext } from "../contexts/app-context";
import { SharedReactThemeProvider } from "../contexts/theme-context";
import { TourTooltip } from "./tour-tooltip";
import type { TourHandle, TourOptions, TourStep } from "./tour-types";
import { buildTourJoyrideOptions } from "./tour.styles";

export function toJoyrideStep(step: TourStep): Step {
	const interaction = step.interaction ?? "none";
	return {
		target: step.target ?? "body",
		content: step.content,
		placement: step.placement ?? (step.target ? "auto" : "center"),
		// "none" blocks the target through the spotlight; "target"/"page" let it
		// through. "page" additionally drops the overlay so a drag can land
		// anywhere on the grid (the drop point is outside the spotlight cutout).
		blockTargetInteraction: interaction === "none",
		hideOverlay: interaction === "page",
		skipScroll: step.disableScroll === true,
		...(step.title !== undefined ? { title: step.title } : {}),
		...(step.before ? { before: async (): Promise<void> => void (await step.before?.()) } : {}),
		...(step.id !== undefined ? { id: step.id } : {}),
	};
}

interface TourRunnerProps {
	steps: TourStep[];
	onClose: (completed: boolean) => void;
}

function TourRunner({ steps, onClose }: TourRunnerProps): ReactElement | null {
	const endedRef = useRef(false);
	const joyrideSteps = useMemo(() => steps.map(toJoyrideStep), [steps]);
	const options = useMemo(() => buildTourJoyrideOptions(), []);

	const { Tour } = useJoyride({
		continuous: true,
		run: true,
		steps: joyrideSteps,
		options,
		tooltipComponent: TourTooltip,
		onEvent: (data, controls) => {
			// ESC fires CLOSE which, in continuous mode, only closes the current
			// step — promote it to a full skip so the tour actually ends.
			if (data.action === ACTIONS.CLOSE && data.origin === ORIGIN.KEYBOARD) {
				controls.skip();
				return;
			}
			if (endedRef.current) return;
			if (data.status === STATUS.FINISHED) {
				endedRef.current = true;
				onClose(true);
			} else if (data.status === STATUS.SKIPPED) {
				endedRef.current = true;
				onClose(false);
			}
		},
	});

	return Tour;
}

/**
 * Launch a guided tour imperatively from anywhere (a command, plugin `onload`, a
 * settings button) — no host React tree required. Mounts a dedicated root on
 * `document.body` so the spotlight can target elements across any workspace leaf,
 * and tears itself down when the tour ends.
 *
 * This is the shared onboarding foundation: every plugin drives it the same way
 * by passing {@link TourStep}s whose `before` hooks navigate their own UI.
 */
export function startTour(options: TourOptions): TourHandle {
	const { app, cssPrefix, testIdPrefix, steps, onClose } = options;

	const container = activeDocument.body.appendChild(activeDocument.createElement("div"));
	container.className = `${cssPrefix ?? ""}tour-portal`;
	const root = createRoot(container);

	let stopped = false;
	const teardown = (): void => {
		if (stopped) return;
		stopped = true;
		// onClose fires from inside joyride's React event cycle; unmounting a root
		// synchronously from within its own tree throws, so defer to a macrotask.
		window.setTimeout(() => {
			root.unmount();
			container.remove();
		}, 0);
	};

	const handleClose = (completed: boolean): void => {
		onClose?.(completed);
		teardown();
	};

	root.render(
		<StrictMode>
			<AppContext value={app}>
				<SharedReactThemeProvider cssPrefix={cssPrefix} testIdPrefix={testIdPrefix ?? cssPrefix}>
					<TourRunner steps={steps} onClose={handleClose} />
				</SharedReactThemeProvider>
			</AppContext>
		</StrictMode>
	);

	return { stop: teardown };
}
