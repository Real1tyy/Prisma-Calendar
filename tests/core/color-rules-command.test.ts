import { describe, expect, it } from "vitest";

import { UpdateColorRulesCommand } from "../../src/core/commands/color-rules-command";
import type { CalendarSettingsStore } from "../../src/core/settings-store";
import type { SingleCalendarConfig } from "../../src/types";

type ColorRules = SingleCalendarConfig["colorRules"];

function makeStoreStub(initialRules: ColorRules) {
	const state = { colorRules: [...initialRules] };
	const store = {
		get currentSettings() {
			return { colorRules: [...state.colorRules] } as SingleCalendarConfig;
		},
		async updateSettings(updater: (s: SingleCalendarConfig) => SingleCalendarConfig) {
			const next = updater(state as SingleCalendarConfig);
			state.colorRules = [...next.colorRules];
		},
		read(): ColorRules {
			return state.colorRules;
		},
	};
	return store as unknown as CalendarSettingsStore & { read(): ColorRules };
}

const RULE_A = { id: "a", expression: "Category.includes('Work')", color: "#ff0000", enabled: true } as const;
const RULE_B = { id: "b", expression: "Category.includes('Personal')", color: "#00ff00", enabled: true } as const;

describe("UpdateColorRulesCommand", () => {
	it("applies the transform on execute", async () => {
		const store = makeStoreStub([{ ...RULE_A }, { ...RULE_B }]);
		const cmd = new UpdateColorRulesCommand(store, (rules) => rules.filter((r) => r.id !== "a"), "delete-rule-a");

		await cmd.execute();

		expect(store.read()).toEqual([{ ...RULE_B }]);
	});

	it("restores the original rules on undo", async () => {
		const store = makeStoreStub([{ ...RULE_A }, { ...RULE_B }]);
		const cmd = new UpdateColorRulesCommand(store, (rules) => rules.filter((r) => r.id !== "a"), "delete-rule-a");

		await cmd.execute();
		await cmd.undo();

		expect(store.read()).toEqual([{ ...RULE_A }, { ...RULE_B }]);
	});

	it("re-applies the transform on redo (second execute)", async () => {
		const store = makeStoreStub([{ ...RULE_A }, { ...RULE_B }]);
		const cmd = new UpdateColorRulesCommand(
			store,
			(rules) => rules.map((r) => (r.id === "a" ? { ...r, expression: "Category.includes('Office')" } : r)),
			"rename-rule-a"
		);

		await cmd.execute();
		await cmd.undo();
		await cmd.execute();

		expect(store.read()).toEqual([{ ...RULE_A, expression: "Category.includes('Office')" }, { ...RULE_B }]);
	});

	it("canUndo is false until first execute", async () => {
		const store = makeStoreStub([{ ...RULE_A }]);
		const cmd = new UpdateColorRulesCommand(store, (r) => r, "noop");

		expect(cmd.canUndo()).toBe(false);
		await cmd.execute();
		expect(cmd.canUndo()).toBe(true);
	});

	it("reports the configured type", () => {
		const store = makeStoreStub([]);
		const cmd = new UpdateColorRulesCommand(store, (r) => r, "my-type");
		expect(cmd.getType()).toBe("my-type");
	});
});
