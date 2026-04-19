import { describe, expect, it } from "vitest";

import { MutuallyExclusiveToggles } from "../../src/settings/mutually-exclusive-toggles";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

interface State {
	a: boolean;
	b: boolean;
}

function setup(initial: State) {
	const store = makeStore<State>(initial);
	const { user, container } = renderReact(
		<MutuallyExclusiveToggles
			store={store}
			toggleA={{ path: "a", name: "Toggle A", description: "desc A" }}
			toggleB={{ path: "b", name: "Toggle B", description: "desc B" }}
		/>
	);
	const toggles = container.querySelectorAll<HTMLElement>(".checkbox-container");
	return { store, user, toggleA: toggles[0]!, toggleB: toggles[1]! };
}

describe("MutuallyExclusiveToggles", () => {
	it("renders both toggles with their names and descriptions", () => {
		const { store } = setup({ a: false, b: false });
		expect(store.currentSettings).toEqual({ a: false, b: false });
	});

	it("enabling A while B is on flips B off", async () => {
		const { store, user, toggleA } = setup({ a: false, b: true });
		await user.click(toggleA);
		expect(store.currentSettings).toEqual({ a: true, b: false });
	});

	it("enabling B while A is on flips A off", async () => {
		const { store, user, toggleB } = setup({ a: true, b: false });
		await user.click(toggleB);
		expect(store.currentSettings).toEqual({ a: false, b: true });
	});

	it("disabling A does not touch B", async () => {
		const { store, user, toggleA } = setup({ a: true, b: false });
		await user.click(toggleA);
		expect(store.currentSettings).toEqual({ a: false, b: false });
	});

	it("enabling one when both are off just enables it", async () => {
		const { store, user, toggleA } = setup({ a: false, b: false });
		await user.click(toggleA);
		expect(store.currentSettings).toEqual({ a: true, b: false });
	});
});
