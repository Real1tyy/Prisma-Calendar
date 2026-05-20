import { AppContext } from "@real1ty-obsidian-plugins-react";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { openCalDAVAddModal, openICSAddModal } from "../../../src/react/modals";
import { IntegrationsSettingsReact } from "../../../src/react/settings/integrations-settings";
import type { CalDAVAccount, ICSSubscription } from "../../../src/types/integrations";
import { CustomCalendarSettingsSchema, type CustomCalendarSettings } from "../../../src/types/settings";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";
import { createMockApp } from "../../setup";

vi.mock("../../../src/core/pro-feature-previews", () => ({
	getFeatureDocUrl: vi.fn().mockReturnValue("https://example.com/docs"),
	getFeaturePreviewSrc: vi.fn().mockReturnValue(null),
	getFeaturePurchaseUrl: vi.fn().mockReturnValue("https://example.com/buy"),
}));

vi.mock("../../../src/react/modals", () => ({
	openCalDAVAddModal: vi.fn().mockResolvedValue(null),
	openCalDAVEditModal: vi.fn().mockResolvedValue(undefined),
	openICSAddModal: vi.fn().mockResolvedValue(null),
	openICSEditModal: vi.fn().mockResolvedValue(undefined),
	openCalendarIntegrationDeleteEventsModal: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../../src/components/settings/generic", () => ({
	showConfirmDeleteModal: vi.fn(),
}));
vi.mock("../../../src/components/settings/integration-shared", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return { ...actual, deleteTrackedIntegrationEvents: vi.fn().mockResolvedValue(undefined) };
});

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
			"[data-testid='prisma-settings-field-holidays-enabled'] .checkbox-container"
		);
		if (toggle) {
			await user.click(toggle);
		}
		const countryField = container.querySelector("[data-testid='prisma-settings-field-holidays-country']");
		expect(countryField).toBeTruthy();
	});

	it("CalDAV account list re-renders after modal updates the store", async () => {
		const { container, findByText, mainStore, user } = setup({ isProEnabled: true });
		expect(container.textContent).toContain("No accounts configured.");

		const newAccount: CalDAVAccount = {
			id: "test-account-1",
			name: "Test Nextcloud",
			serverUrl: "https://example.com/dav",
			authMethod: "Basic",
			credentials: { username: "alice", passwordSecretName: "pw-secret" },
			enabled: true,
			calendarId: "test-calendar",
			selectedCalendars: [],
			syncIntervalMinutes: 15,
			timezone: "UTC",
			createdAt: Date.now(),
		};
		vi.mocked(openCalDAVAddModal).mockImplementationOnce(async (_app, store: any) => {
			await store.updateSettings((s: CustomCalendarSettings) => ({
				...s,
				caldav: { ...s.caldav, accounts: [...s.caldav.accounts, newAccount] },
			}));
			return newAccount;
		});

		const addBtn = container.querySelector<HTMLElement>(".prisma-caldav-add-account-button");
		expect(addBtn).toBeTruthy();
		await user.click(addBtn!);

		await findByText("Test Nextcloud");
		expect(container.textContent).not.toContain("No accounts configured.");
		expect(mainStore.currentSettings.caldav.accounts).toHaveLength(1);
	});

	it("ICS subscription list re-renders after modal updates the store", async () => {
		const { container, findByText, mainStore, user } = setup({ isProEnabled: true });
		expect(container.textContent).toContain("No subscriptions configured.");

		const newSubscription: ICSSubscription = {
			id: "test-sub-1",
			name: "Test Calendar Feed",
			urlSecretName: "ics-url-secret",
			enabled: true,
			calendarId: "test-calendar",
			syncIntervalMinutes: 60,
			timezone: "UTC",
			createdAt: Date.now(),
		};
		vi.mocked(openICSAddModal).mockImplementationOnce(async (_app, store: any) => {
			await store.updateSettings((s: CustomCalendarSettings) => ({
				...s,
				icsSubscriptions: {
					...s.icsSubscriptions,
					subscriptions: [...s.icsSubscriptions.subscriptions, newSubscription],
				},
			}));
			return newSubscription;
		});

		const addBtn = Array.from(container.querySelectorAll<HTMLElement>(".prisma-caldav-add-account-button")).find(
			(el) => el.textContent === "Add subscription"
		);
		expect(addBtn).toBeTruthy();
		await user.click(addBtn!);

		await findByText("Test Calendar Feed");
		expect(container.textContent).not.toContain("No subscriptions configured.");
		expect(mainStore.currentSettings.icsSubscriptions.subscriptions).toHaveLength(1);
	});
});
