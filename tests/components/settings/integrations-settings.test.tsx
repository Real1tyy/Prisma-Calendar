import { AppContext } from "@real1ty-obsidian-plugins-react";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { IntegrationsSettingsReact } from "../../../src/react/settings/integrations-settings";
import { type CustomCalendarSettings, CustomCalendarSettingsSchema } from "../../../src/types/settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";
import { createMockApp } from "../../setup";

vi.mock("../../../src/core/pro-feature-previews", () => ({
	getFeatureDocUrl: vi.fn().mockReturnValue("https://example.com/docs"),
	getFeaturePreviewSrc: vi.fn().mockReturnValue(null),
	getFeaturePurchaseUrl: vi.fn().mockReturnValue("https://example.com/buy"),
}));

vi.mock("../../../src/components/settings/caldav/add-modal", () => ({
	showAddCalDAVAccountModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/caldav/edit-modal", () => ({
	showEditCalDAVAccountModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/ics-subscriptions/add-modal", () => ({
	showAddICSSubscriptionModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/ics-subscriptions/edit-modal", () => ({
	showEditICSSubscriptionModal: vi.fn(),
}));
vi.mock("../../../src/components/modals", () => ({
	showCalendarIntegrationDeleteEventsModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/generic", () => ({
	showConfirmDeleteModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/integration-shared", () => ({
	deleteTrackedIntegrationEvents: vi.fn().mockResolvedValue(undefined),
}));

function createMockMainStore(overrides: Partial<CustomCalendarSettings> = {}) {
	const defaults = CustomCalendarSettingsSchema.parse({});
	const settings = { ...defaults, ...overrides } as CustomCalendarSettings;
	const subject = new BehaviorSubject(settings);
	return {
		settings$: subject,
		get currentSettings() {
			return subject.getValue();
		},
		async updateSettings(updater: (s: CustomCalendarSettings) => CustomCalendarSettings) {
			subject.next(updater(subject.getValue()));
		},
	} as any;
}

function createMockPlugin(isProEnabled = false) {
	return {
		isProEnabled,
		calendarBundles: [],
		syncSingleAccount: vi.fn().mockResolvedValue(undefined),
		syncSingleICSSubscription: vi.fn().mockResolvedValue(undefined),
	} as any;
}

function setup(opts: { isProEnabled?: boolean; mainOverrides?: Partial<CustomCalendarSettings> } = {}) {
	const calendarStore = createMockCalendarSettingsStore();
	const mainStore = createMockMainStore(opts.mainOverrides);
	const plugin = createMockPlugin(opts.isProEnabled ?? false);
	const user = userEvent.setup();
	const app = createMockApp();
	const result = render(
		<AppContext value={app as any}>
			<IntegrationsSettingsReact settingsStore={calendarStore} plugin={plugin} mainSettingsStore={mainStore} />
		</AppContext>
	);
	return { calendarStore, mainStore, plugin, user, ...result };
}

describe("IntegrationsSettingsReact", () => {
	it("renders integrations heading", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toContain("Integrations");
	});

	it("renders export and import buttons", () => {
		const { container } = setup();
		expect(container.textContent).toContain("Export calendar");
		expect(container.textContent).toContain("Import .ics");
	});

	it("renders pro upgrade banners for CalDAV and ICS when not pro", () => {
		const { container } = setup({ isProEnabled: false });
		const proBanners = container.querySelectorAll(".prisma-pro-upgrade-banner");
		expect(proBanners.length).toBeGreaterThanOrEqual(2);
	});

	it("renders CalDAV and ICS sections when pro is enabled", () => {
		const { container } = setup({ isProEnabled: true });
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toContain("Calendar sync (read-only)");
		expect(headings).toContain("ICS URL subscriptions (read-only)");
	});

	it("renders holidays section with toggle", () => {
		const { container } = setup();
		const headings = Array.from(
			container.querySelectorAll<HTMLElement>(".setting-item-heading .setting-item-name")
		).map((el) => el.textContent);
		expect(headings).toContain("Holidays");
	});

	it("shows holiday details when holidays enabled", async () => {
		const { container, user } = setup();
		const toggle = container.querySelector<HTMLElement>(
			"[data-testid='prisma-settings-field-holidaysEnabled'] .checkbox-container"
		);
		if (toggle) {
			await user.click(toggle);
		}
		const countryField = container.querySelector("[data-testid='prisma-settings-field-holidaysCountry']");
		expect(countryField).toBeTruthy();
	});
});
