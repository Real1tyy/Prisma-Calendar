import { AppContext } from "@real1ty-obsidian-plugins-react";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { SingleCalendarSettingsReact } from "../../../src/react/settings/single-calendar-settings-react";
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
	showCategoryDeleteModal: vi.fn(),
	showCategoryRenameModal: vi.fn(),
	showCategoryEventsModal: vi.fn(),
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
		getDefaults() {
			return defaults;
		},
	} as any;
}

function createMockPlugin() {
	return {
		isProEnabled: false,
		calendarBundles: [],
		settingsStore: createMockMainStore(),
		licenseManager: { status$: new BehaviorSubject("inactive") },
		syncStore: { data: { readOnly: false }, updateData: vi.fn() },
		syncSingleAccount: vi.fn(),
		syncSingleICSSubscription: vi.fn(),
	} as any;
}

function setup(opts: { initialTab?: string | undefined } = {}) {
	const calendarStore = createMockCalendarSettingsStore();
	const mainStore = createMockMainStore();
	const plugin = createMockPlugin();
	plugin.settingsStore = mainStore;
	const user = userEvent.setup();
	const app = createMockApp();
	const result = render(
		<AppContext value={app as any}>
			<SingleCalendarSettingsReact
				settingsStore={calendarStore}
				plugin={plugin}
				mainSettingsStore={mainStore}
				{...(opts.initialTab ? { initialTab: opts.initialTab } : {})}
			/>
		</AppContext>
	);
	return { calendarStore, mainStore, plugin, user, ...result };
}

describe("SingleCalendarSettingsReact", () => {
	it("renders navigation tabs", () => {
		const { container } = setup();
		const tabButtons = container.querySelectorAll("[data-testid^='prisma-settings-nav-']");
		expect(tabButtons.length).toBeGreaterThan(0);

		const tabIds = Array.from(tabButtons).map((el) => el.getAttribute("data-testid"));
		expect(tabIds).toContain("prisma-settings-nav-general");
		expect(tabIds).toContain("prisma-settings-nav-properties");
		expect(tabIds).toContain("prisma-settings-nav-calendar");
		expect(tabIds).toContain("prisma-settings-nav-rules");
		expect(tabIds).toContain("prisma-settings-nav-ai");
	});

	it("defaults to general tab", () => {
		const { container } = setup();
		const generalTab = container.querySelector("[data-testid='prisma-settings-nav-general']");
		expect(generalTab?.classList.contains("prisma-active")).toBe(true);
	});

	it("switches to specified initial tab", () => {
		const { container } = setup({ initialTab: "rules" });
		const rulesTab = container.querySelector("[data-testid='prisma-settings-nav-rules']");
		expect(rulesTab?.classList.contains("prisma-active")).toBe(true);
	});

	it("navigates to another tab on click", async () => {
		const { container, user } = setup();
		const rulesTab = container.querySelector<HTMLButtonElement>("[data-testid='prisma-settings-nav-rules']");
		expect(rulesTab).toBeTruthy();
		await user.click(rulesTab!);
		expect(rulesTab?.classList.contains("prisma-active")).toBe(true);
	});

	it("renders footer links", () => {
		const { container } = setup();
		const footerLinks = container.querySelectorAll(".prisma-settings-footer-links a");
		expect(footerLinks.length).toBeGreaterThan(0);
	});

	it("renders search input", () => {
		const { container } = setup();
		const searchInput = container.querySelector<HTMLInputElement>(".prisma-settings-search-input");
		expect(searchInput).toBeTruthy();
		expect(searchInput!.placeholder).toBe("Search settings...");
	});
});
