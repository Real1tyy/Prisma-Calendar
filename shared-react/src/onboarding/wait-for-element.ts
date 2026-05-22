/**
 * Resolve once the first element matching `selector` exists in `root`, or `null`
 * if it never appears within `timeout`. Onboarding tours use this inside a step's
 * `before` hook to block until a view has mounted / an event tile has rendered,
 * so the spotlight never anchors to a not-yet-existing node.
 *
 * Resolves immediately when the element is already present. Otherwise it watches
 * the subtree with a `MutationObserver` and races a timeout — both paths
 * disconnect the observer so there is no leak.
 */
export function waitForElement(
	selector: string,
	options?: { timeout?: number | undefined; root?: ParentNode | undefined }
): Promise<HTMLElement | null> {
	const root = options?.root ?? document;
	const timeout = options?.timeout ?? 5000;

	const immediate = root.querySelector<HTMLElement>(selector);
	if (immediate) return Promise.resolve(immediate);

	return new Promise((resolve) => {
		let settled = false;
		const finish = (el: HTMLElement | null): void => {
			if (settled) return;
			settled = true;
			observer.disconnect();
			window.clearTimeout(timer);
			resolve(el);
		};

		const observer = new MutationObserver(() => {
			const found = root.querySelector<HTMLElement>(selector);
			if (found) finish(found);
		});

		const observeTarget = root instanceof Document ? root.documentElement : (root as Node);
		observer.observe(observeTarget, { childList: true, subtree: true });

		const timer = window.setTimeout(() => finish(root.querySelector<HTMLElement>(selector)), timeout);
	});
}
