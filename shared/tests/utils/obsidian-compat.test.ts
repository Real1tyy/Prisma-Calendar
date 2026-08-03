import type { ButtonComponent, SliderComponent } from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";

import { markDestructive, showSliderValue } from "../../src/utils/obsidian-compat";

const requireApiVersion = vi.hoisted(() => vi.fn(() => false));
vi.mock("obsidian", () => ({ requireApiVersion }));

afterEach(() => {
	requireApiVersion.mockReturnValue(false);
});

function buttonWith(methods: { setDestructive?: boolean; setWarning?: boolean }) {
	const calls: string[] = [];
	const button: Record<string, () => unknown> = {};
	if (methods.setDestructive) button["setDestructive"] = () => calls.push("setDestructive");
	if (methods.setWarning) button["setWarning"] = () => calls.push("setWarning");
	return { button: button as unknown as ButtonComponent, calls };
}

describe("markDestructive", () => {
	it("prefers setDestructive when the running app provides it", () => {
		const { button, calls } = buttonWith({ setDestructive: true, setWarning: true });

		expect(markDestructive(button)).toBe(button);
		expect(calls).toEqual(["setDestructive"]);
	});

	it("falls back to setWarning below 1.13, where setDestructive does not exist", () => {
		const { button, calls } = buttonWith({ setWarning: true });

		markDestructive(button);

		expect(calls).toEqual(["setWarning"]);
	});

	it("is a no-op when the app provides neither", () => {
		const { button, calls } = buttonWith({});

		expect(() => markDestructive(button)).not.toThrow();
		expect(calls).toEqual([]);
	});
});

describe("showSliderValue", () => {
	it("calls setDynamicTooltip below 1.13, the only affordance there", () => {
		const setDynamicTooltip = vi.fn();
		const slider = { setDynamicTooltip } as unknown as SliderComponent;

		expect(showSliderValue(slider)).toBe(slider);
		expect(setDynamicTooltip).toHaveBeenCalledTimes(1);
	});

	it("skips it on 1.13+, which always renders the value inline", () => {
		requireApiVersion.mockReturnValue(true);
		const setDynamicTooltip = vi.fn();
		const slider = { setDynamicTooltip } as unknown as SliderComponent;

		showSliderValue(slider);

		expect(setDynamicTooltip).not.toHaveBeenCalled();
	});
});
