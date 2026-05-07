/** A single visual-regression scenario: a render() that returns the root element to screenshot. */
export interface Scenario {
	/** Stable identifier used as the fixture filename and test name. */
	name: string;
	/** CSS width of the #root container. Default: "480px". */
	width?: string | undefined;
	/** Render the component into a fresh container and return it. */
	render(): HTMLElement;
	/**
	 * Runs after fixture HTML is captured from `render()` output.
	 * Use to unmount React roots, clear timers, etc. so jsdom teardown does not race async work.
	 */
	teardown?: (root: HTMLElement) => void;
}
