import type { App } from "obsidian";
import type { ReactNode } from "react";
import type { Placement } from "react-joyride";

/** Where the spotlight points: a CSS selector, a live element, or a resolver. */
export type TourTarget = string | HTMLElement | (() => HTMLElement | null);

/**
 * One step of a guided tour, expressed in plugin-domain terms rather than
 * react-joyride's. The host engine ({@link startTour}) maps these onto joyride
 * `Step`s and applies Obsidian-native theming, so adopting plugins never touch
 * the underlying library.
 */
export interface TourStep {
	/**
	 * Spotlight target. Omit for a centered, target-less step (welcome / finish).
	 */
	target?: TourTarget | undefined;
	title?: ReactNode | undefined;
	content: ReactNode;
	/**
	 * Tooltip side relative to the target. `"center"` floats it mid-screen;
	 * `"auto"` lets the engine pick the side with the most room.
	 */
	placement?: Placement | "auto" | "center" | undefined;
	/**
	 * Async setup run *before* the step is shown — navigate a view, seed a sample
	 * note, await an element. The tour blocks (showing a loader) until it resolves,
	 * which is what makes a multi-view tour deterministic and replayable.
	 */
	before?: (() => void | Promise<unknown>) | undefined;
	/**
	 * Let the user interact with the highlighted element through the spotlight
	 * (drag an event, click a button). Defaults to `true` — set `false` to make
	 * the step read-only.
	 */
	allowInteraction?: boolean | undefined;
	/**
	 * Skip auto-scrolling the target into view. Use for targets that live inside
	 * a nested scroll container (e.g. FullCalendar's grid) that the page-level
	 * scroller can't reach correctly.
	 */
	disableScroll?: boolean | undefined;
	/** Stable id for debugging / analytics. */
	id?: string | undefined;
}

export interface TourOptions {
	app: App;
	steps: TourStep[];
	/** CSS prefix for the injected tooltip styles (e.g. `"prisma-"`). */
	cssPrefix?: string | undefined;
	/** TestId prefix for the tooltip + its controls. Defaults to `cssPrefix`. */
	testIdPrefix?: string | undefined;
	/**
	 * Fired once when the tour ends. `completed` is `true` when the user reaches
	 * the final step's "Done", `false` when they skip / close / press Escape.
	 */
	onClose?: ((completed: boolean) => void) | undefined;
}

export interface TourHandle {
	/** Tear down the tour immediately (does not fire `onClose`). */
	stop(): void;
}
