import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { pathFilteredSnapshot } from "../src/hooks/use-schema-field";

interface TestSettings {
	alpha: string;
	beta: number;
	nested: { inner: boolean; other: string };
}

function makeStore(initial: TestSettings) {
	const settings$ = new BehaviorSubject<TestSettings>(initial);
	return {
		settings$,
		currentSettings: initial,
		updateSettings: async (updater: (s: TestSettings) => TestSettings) => {
			settings$.next(updater(settings$.getValue()));
		},
	};
}

describe("pathFilteredSnapshot", () => {
	const baseline: TestSettings = {
		alpha: "a0",
		beta: 0,
		nested: { inner: false, other: "x" },
	};

	it("getValue reads the current value at the dotted path", () => {
		const store = makeStore(baseline);
		const source = pathFilteredSnapshot<string>(store, "alpha");

		expect(source.getValue()).toBe("a0");

		store.settings$.next({ ...baseline, alpha: "a1" });
		expect(source.getValue()).toBe("a1");
	});

	it("resolves nested dotted paths", () => {
		const store = makeStore(baseline);
		const source = pathFilteredSnapshot<boolean>(store, "nested.inner");

		expect(source.getValue()).toBe(false);

		store.settings$.next({ ...baseline, nested: { ...baseline.nested, inner: true } });
		expect(source.getValue()).toBe(true);
	});

	it("notifies the listener only when the path's value changes", () => {
		const store = makeStore(baseline);
		const source = pathFilteredSnapshot<string>(store, "alpha");
		const listener = vi.fn();

		const sub = source.subscribe(listener);

		// Update unrelated field `beta` — listener must NOT fire.
		store.settings$.next({ ...baseline, beta: 1 });
		expect(listener).not.toHaveBeenCalled();

		// Update the target field `alpha` — listener fires once.
		store.settings$.next({ ...baseline, beta: 1, alpha: "a1" });
		expect(listener).toHaveBeenCalledTimes(1);

		// Re-emit the same `alpha` value (reference-equal) — listener does NOT fire.
		store.settings$.next({ ...baseline, beta: 2, alpha: "a1" });
		expect(listener).toHaveBeenCalledTimes(1);

		// Change `alpha` again — listener fires.
		store.settings$.next({ ...baseline, alpha: "a2" });
		expect(listener).toHaveBeenCalledTimes(2);

		sub.unsubscribe();
	});

	it("isolates multiple path subscriptions to their own paths", () => {
		const store = makeStore(baseline);
		const alphaListener = vi.fn();
		const betaListener = vi.fn();

		const alphaSub = pathFilteredSnapshot(store, "alpha").subscribe(alphaListener);
		const betaSub = pathFilteredSnapshot(store, "beta").subscribe(betaListener);

		store.settings$.next({ ...baseline, alpha: "a1" });
		expect(alphaListener).toHaveBeenCalledTimes(1);
		expect(betaListener).not.toHaveBeenCalled();

		store.settings$.next({ ...baseline, alpha: "a1", beta: 42 });
		expect(alphaListener).toHaveBeenCalledTimes(1);
		expect(betaListener).toHaveBeenCalledTimes(1);

		alphaSub.unsubscribe();
		betaSub.unsubscribe();
	});

	it("filters nested-path emissions correctly when a sibling key under the same parent changes", () => {
		const store = makeStore(baseline);
		const source = pathFilteredSnapshot<boolean>(store, "nested.inner");
		const listener = vi.fn();
		source.subscribe(listener);

		// `nested.other` changes but `nested.inner` does not — listener must NOT fire
		// even though the `nested` object reference changed.
		store.settings$.next({ ...baseline, nested: { inner: false, other: "y" } });
		expect(listener).not.toHaveBeenCalled();

		// Now change `nested.inner` — listener fires.
		store.settings$.next({ ...baseline, nested: { inner: true, other: "y" } });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("unsubscribe stops further notifications", () => {
		const store = makeStore(baseline);
		const source = pathFilteredSnapshot<string>(store, "alpha");
		const listener = vi.fn();
		const sub = source.subscribe(listener);

		store.settings$.next({ ...baseline, alpha: "a1" });
		expect(listener).toHaveBeenCalledTimes(1);

		sub.unsubscribe();

		store.settings$.next({ ...baseline, alpha: "a2" });
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
