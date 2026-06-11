import { LicenseStatusSchema, type LicenseManager, type LicenseStatus } from "@real1ty/obsidian-plugins";
import { screen, within } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { GeneralSection, type GeneralSectionProps } from "../../../src/widgets/general-section/general-section";
import { renderWithProviders } from "../../harness/render-with-providers";
import { makeStore } from "../../helpers/make-store";

const PREFIX = "test-";

interface TestSettings {
	enabled: boolean;
	secret: string;
	[key: string]: unknown;
}

const DEFAULTS: TestSettings = { enabled: true, secret: "" };

function makeManager(): LicenseManager {
	const status: LicenseStatus = LicenseStatusSchema.parse({});
	const status$ = new BehaviorSubject<LicenseStatus>(status);
	return {
		status$,
		get status() {
			return status$.getValue();
		},
		productName: "Test Plugin",
		purchaseUrl: "https://example.com/buy",
		refreshLicense: vi.fn().mockResolvedValue(undefined),
		deactivateDevice: vi.fn().mockResolvedValue(true),
	} as unknown as LicenseManager;
}

const HELP: GeneralSectionProps<TestSettings>["help"] = {
	pluginDisplayName: "Test Plugin",
	documentationUrl: "https://docs.example.com",
	faqUrl: "https://docs.example.com/faq",
	troubleshootingUrl: "https://docs.example.com/troubleshooting",
	githubIssuesUrl: "https://github.com/example/repo/issues/new",
	feedbackUrl: "https://example.com/feedback",
	pro: {
		productName: "Test Pro",
		productPageUrl: "https://example.com/pro",
		pitch: "unlocks advanced workflows.",
	},
};

type Overrides = Partial<GeneralSectionProps<TestSettings>>;

function renderSection(overrides: Overrides = {}) {
	const store = makeStore<TestSettings>(structuredClone(DEFAULTS));
	const onView = vi.fn();
	const ui = (
		<GeneralSection<TestSettings>
			slug="prisma-calendar"
			testIdPrefix={PREFIX}
			help={HELP}
			changelog={{ onView }}
			settingsTransfer={{ store, defaults: DEFAULTS, nonTransferableKeys: ["secret"] }}
			{...overrides}
		/>
	);
	return { store, onView, ...renderWithProviders(ui, { cssPrefix: PREFIX, testIdPrefix: PREFIX }) };
}

function queryLicense(): HTMLElement | null {
	return screen.queryByText("License key");
}

describe("GeneralSection", () => {
	describe("default-on universal sub-sections", () => {
		it("renders Help & Support, Changelog and Settings transfer when their flags are omitted", () => {
			renderSection();
			expect(screen.getByTestId(`${PREFIX}help`)).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "View changelog" })).toBeInTheDocument();
			expect(screen.getByText("Settings transfer")).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
		});

		it("fires the changelog opener when the button is clicked", async () => {
			const { onView, user } = renderSection();
			await user.click(screen.getByRole("button", { name: "View changelog" }));
			expect(onView).toHaveBeenCalledOnce();
		});

		it.each([
			["help", { help: { ...HELP, enabled: false } }, () => screen.queryByTestId(`${PREFIX}help`)],
			[
				"changelog",
				{ changelog: { onView: vi.fn(), enabled: false } },
				() => screen.queryByRole("button", { name: "View changelog" }),
			],
		])("hides the %s sub-section independently when enabled is false", (_label, overrides, query) => {
			renderSection(overrides as Overrides);
			expect(query()).toBeNull();
		});

		it("hides Settings transfer independently when enabled is false", () => {
			const store = makeStore<TestSettings>(structuredClone(DEFAULTS));
			renderSection({ settingsTransfer: { store, defaults: DEFAULTS, enabled: false } });
			expect(screen.queryByText("Settings transfer")).toBeNull();
			// The other two are unaffected.
			expect(screen.getByTestId(`${PREFIX}help`)).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "View changelog" })).toBeInTheDocument();
		});
	});

	describe("license card (opt-in)", () => {
		it("does not render the License card when the license config is omitted", () => {
			renderSection();
			expect(queryLicense()).toBeNull();
		});

		it("does not render the License card when license.enabled is false", () => {
			renderSection({
				license: {
					enabled: false,
					licenseManager: makeManager(),
					currentSecretName: "key",
					onSecretChange: () => Promise.resolve(),
				},
			});
			expect(queryLicense()).toBeNull();
		});

		it("renders the License card when license.enabled is true", () => {
			renderSection({
				license: {
					enabled: true,
					licenseManager: makeManager(),
					currentSecretName: "key",
					onSecretChange: () => Promise.resolve(),
				},
			});
			expect(queryLicense()).toBeInTheDocument();
		});
	});

	describe("actions slot", () => {
		it("renders an empty actions container when no actions are passed", () => {
			renderSection();
			const slot = screen.getByTestId(`${PREFIX}general-actions`);
			expect(slot).toBeInTheDocument();
			expect(slot).toBeEmptyDOMElement();
		});

		it("renders consumer-provided actions inside the stable slot", () => {
			renderSection({ actions: <button type="button">Rate plugin</button> });
			const slot = screen.getByTestId(`${PREFIX}general-actions`);
			expect(within(slot).getByRole("button", { name: "Rate plugin" })).toBeInTheDocument();
		});
	});

	describe("composition slots", () => {
		it("renders plugin-specific children", () => {
			renderSection({ children: <div data-testid="plugin-extra">Event presets</div> });
			expect(screen.getByTestId("plugin-extra")).toBeInTheDocument();
		});

		it("renders registered extra sub-sections in order", () => {
			renderSection({
				extraSections: [
					{ id: "logging", node: <div data-testid="extra-logging">Logging</div> },
					{ id: "doctor", node: <div data-testid="extra-doctor">Doctor</div> },
				],
			});
			expect(screen.getByTestId("extra-logging")).toBeInTheDocument();
			expect(screen.getByTestId("extra-doctor")).toBeInTheDocument();
		});
	});

	describe("UTM attribution", () => {
		it("routes every outbound link through buildUtmUrl (no hand-built strings)", () => {
			const { container } = renderSection();
			const anchors = Array.from(container.querySelectorAll("a"));
			expect(anchors.length).toBeGreaterThan(0);
			for (const anchor of anchors) {
				const url = new URL(anchor.href);
				expect(url.searchParams.get("utm_campaign")).toBe("prisma_calendar");
				expect(url.searchParams.get("utm_source")).toBe("plugin");
				expect(url.searchParams.get("utm_medium")).toBe("settings");
				expect(url.searchParams.get("utm_content")).not.toBeNull();
			}
		});
	});
});
