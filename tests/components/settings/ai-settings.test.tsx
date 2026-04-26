import { AppContext } from "@real1ty-obsidian-plugins-react";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { AISettingsReact } from "../../../src/react/settings/ai-settings";
import { AI_DEFAULTS } from "../../../src/types/ai";
import { type CustomCalendarSettings, CustomCalendarSettingsSchema } from "../../../src/types/settings";
import { createMockApp } from "../../setup";

vi.mock("../../../src/core/pro-feature-previews", () => ({
	getFeatureDocUrl: vi.fn().mockReturnValue("https://example.com/docs"),
	getFeaturePreviewSrc: vi.fn().mockReturnValue(null),
	getFeaturePurchaseUrl: vi.fn().mockReturnValue("https://example.com/buy"),
}));

function createMockMainStore(overrides: Partial<CustomCalendarSettings> = {}) {
	const defaults = CustomCalendarSettingsSchema.parse({});
	const settings = { ...defaults, ...overrides } as CustomCalendarSettings;
	const subject = new BehaviorSubject(settings);
	const store = {
		settings$: subject,
		get currentSettings() {
			return subject.getValue();
		},
		async updateSettings(updater: (s: CustomCalendarSettings) => CustomCalendarSettings) {
			const next = updater(subject.getValue());
			subject.next(next);
		},
	};
	return store as any;
}

function setup(overrides: Partial<CustomCalendarSettings> = {}) {
	const store = createMockMainStore(overrides);
	const user = userEvent.setup();
	const app = createMockApp();
	const result = render(
		<AppContext value={app as any}>
			<AISettingsReact mainSettingsStore={store} />
		</AppContext>
	);
	return { store, user, ...result };
}

describe("AISettingsReact", () => {
	it("renders section headings", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);

		expect(headings).toEqual(
			expect.arrayContaining(["AI Assistant", "Event Manipulation", "Planning", "Custom Prompts"])
		);
	});

	it("renders model dropdown with current value", () => {
		const { container } = setup();
		const modelRow = Array.from(container.querySelectorAll<HTMLElement>(".setting-item")).find(
			(el) => el.querySelector(".setting-item-name")?.textContent === "Model"
		);
		expect(modelRow).toBeTruthy();
		const select = modelRow!.querySelector<HTMLSelectElement>("select");
		expect(select).toBeTruthy();
		expect(select!.value).toBe(AI_DEFAULTS.DEFAULT_MODEL);
	});

	it("updates model on dropdown change", async () => {
		const { store, user, container } = setup();
		const modelRow = Array.from(container.querySelectorAll<HTMLElement>(".setting-item")).find(
			(el) => el.querySelector(".setting-item-name")?.textContent === "Model"
		);
		const select = modelRow!.querySelector<HTMLSelectElement>("select")!;
		await user.selectOptions(select, "claude-opus-4-6");
		expect(store.currentSettings.ai.aiModel).toBe("claude-opus-4-6");
	});

	it("shows 'No custom prompts defined yet.' when empty", () => {
		const { container } = setup();
		expect(container.textContent).toContain("No custom prompts defined yet.");
	});

	it("renders existing custom prompts", () => {
		const { container } = setup({
			ai: {
				...CustomCalendarSettingsSchema.parse({}).ai,
				customPrompts: [{ id: "1", title: "Test Prompt", content: "Some content here" }],
			},
		});
		expect(container.textContent).toContain("Test Prompt");
		expect(container.textContent).toContain("Some content here");
	});
});
