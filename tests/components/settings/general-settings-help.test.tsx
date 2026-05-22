import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type CustomCalendarPlugin from "../../../src/main";
import { startPrismaTour } from "../../../src/react/onboarding/prisma-tour";
import { HelpSection } from "../../../src/react/settings/general-settings";
import { createMockMainSettingsStore } from "../../fixtures/settings-fixtures";

vi.mock("../../../src/react/onboarding/prisma-tour", () => ({ startPrismaTour: vi.fn() }));

function setup() {
	const settingsStore = createMockMainSettingsStore();
	const closeSettings = vi.fn();
	const plugin = {
		settingsStore,
		changelogContent: "",
		manifest: { version: "1.0.0" },
		app: { setting: { close: closeSettings } },
	} as unknown as CustomCalendarPlugin;
	const user = userEvent.setup();
	render(<HelpSection plugin={plugin} />);
	return { plugin, settingsStore, user, closeSettings };
}

describe("HelpSection — interactive tutorial control", () => {
	it("offers to take the tour before it has been completed", () => {
		setup();
		expect(screen.getByTestId("prisma-settings-tutorial-btn").textContent).toBe("Take the tutorial");
	});

	it("dismisses the settings modal and launches the tour when clicked", async () => {
		const { plugin, user, closeSettings } = setup();
		await user.click(screen.getByTestId("prisma-settings-tutorial-btn"));

		// Settings must close first, otherwise the spotlight opens behind the modal.
		expect(closeSettings).toHaveBeenCalledTimes(1);
		expect(startPrismaTour).toHaveBeenCalledTimes(1);
		expect(startPrismaTour).toHaveBeenCalledWith(plugin);
	});

	it("switches to a replay label once the tutorial is marked completed", async () => {
		const { settingsStore } = setup();
		await settingsStore.updateSettings((s) => ({ ...s, tutorialCompleted: true }));

		expect((await screen.findByTestId("prisma-settings-tutorial-btn")).textContent).toBe("Replay tutorial");
	});
});
