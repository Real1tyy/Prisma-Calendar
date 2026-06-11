import { LicenseStatusSchema, type LicenseStatus } from "@real1ty/obsidian-plugins";
import { AppContext, SharedReactThemeProvider } from "@real1ty/obsidian-plugins-react";
import { render, screen } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import type CustomCalendarPlugin from "../../../src/main";
import { GeneralSettingsReact } from "../../../src/react/settings/general-settings";
import { CustomCalendarSettingsSchema, type CustomCalendarSettings } from "../../../src/types/settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";
import { createMockApp } from "../../setup";

function createMainStore() {
	const defaults = CustomCalendarSettingsSchema.parse({});
	const subject = new BehaviorSubject<CustomCalendarSettings>(defaults);
	return {
		settings$: subject,
		get currentSettings() {
			return subject.getValue();
		},
		async updateSettings(updater: (s: CustomCalendarSettings) => CustomCalendarSettings) {
			subject.next(updater(subject.getValue()));
		},
		getDefaults() {
			return defaults;
		},
	} as unknown as CustomCalendarPlugin["settingsStore"];
}

function createMockPlugin(): CustomCalendarPlugin {
	const status$ = new BehaviorSubject<LicenseStatus>(LicenseStatusSchema.parse({}));
	return {
		isProEnabled: false,
		settingsStore: createMainStore(),
		licenseManager: {
			status$,
			get status() {
				return status$.getValue();
			},
			productName: "Prisma Calendar",
			purchaseUrl: "https://example.com/buy",
			refreshLicense: vi.fn().mockResolvedValue(undefined),
			deactivateDevice: vi.fn().mockResolvedValue(true),
		},
		changelogContent: "",
		manifest: { version: "1.0.0" },
		app: createMockApp(),
		syncStore: { data: { readOnly: false }, updateData: vi.fn() },
	} as unknown as CustomCalendarPlugin;
}

function setup() {
	const calendarStore = createMockCalendarSettingsStore();
	const plugin = createMockPlugin();
	const app = createMockApp();
	const result = render(
		<SharedReactThemeProvider cssPrefix="prisma-" testIdPrefix="prisma-">
			<AppContext value={app as never}>
				<GeneralSettingsReact settingsStore={calendarStore} plugin={plugin} />
			</AppContext>
		</SharedReactThemeProvider>
	);
	return { calendarStore, plugin, ...result };
}

describe("GeneralSettingsReact (migrated to shared GeneralSection)", () => {
	it("renders the License card via the shared section", () => {
		setup();
		expect(screen.queryByText("License key")).not.toBeNull();
	});

	it("renders the shared Help & Support, Changelog and Settings transfer sub-sections", () => {
		setup();
		expect(screen.queryByTestId("prisma-settings-help")).not.toBeNull();
		expect(screen.queryByTestId("prisma-settings-changelog-btn")).not.toBeNull();
		expect(screen.queryByText("Settings transfer")).not.toBeNull();
		expect(screen.queryByTestId("prisma-settings-transfer-import-button")).not.toBeNull();
		expect(screen.queryByTestId("prisma-settings-transfer-export-button")).not.toBeNull();
	});

	it("keeps the plugin-specific Event presets section composed via the slot", () => {
		setup();
		expect(screen.queryByText("Event presets")).not.toBeNull();
		expect(screen.queryByTestId("prisma-settings-field-default-preset-id")).not.toBeNull();
	});

	it("keeps the plugin-specific Read-only mode field composed via the slot", () => {
		setup();
		expect(screen.queryByTestId("prisma-settings-field-read-only")).not.toBeNull();
	});

	it("routes the shared section's outbound links through buildUtmUrl", () => {
		setup();
		const helpCard = screen.getByTestId("prisma-settings-help");
		const anchors = Array.from(helpCard.querySelectorAll("a"));
		expect(anchors.length).toBeGreaterThan(0);
		for (const anchor of anchors) {
			const url = new URL(anchor.href);
			expect(url.searchParams.get("utm_campaign")).toBe("prisma_calendar");
			expect(url.searchParams.get("utm_medium")).toBe("settings");
		}
	});
});
