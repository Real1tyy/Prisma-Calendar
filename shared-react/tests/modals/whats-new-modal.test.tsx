import { getChangelogSince } from "@real1ty-obsidian-plugins";
import { screen } from "@testing-library/react";
import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { WhatsNewModalConfig } from "../../src/modals/whats-new-modal";
import { WhatsNewContent } from "../../src/modals/whats-new-modal";
import { renderWithProviders } from "../harness/render-with-providers";

vi.mock("@real1ty-obsidian-plugins", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...(actual as Record<string, unknown>),
		getChangelogSince: vi.fn().mockReturnValue([]),
		formatChangelogSections: vi.fn().mockReturnValue(""),
	};
});

const mockedGetChangelogSince = vi.mocked(getChangelogSince);

function makeConfig(overrides: Partial<WhatsNewModalConfig> = {}): WhatsNewModalConfig {
	return {
		cssPrefix: "test",
		pluginName: "Test Plugin",
		changelogContent: "## 1.0.0\n- Initial release",
		links: {
			support: "https://example.com/support",
			changelog: "https://example.com/changelog",
			documentation: "https://example.com/docs",
			github: "https://example.com/github",
			...overrides.links,
		},
		...overrides,
	};
}

const mockPlugin = { app: {} } as unknown as Plugin;

describe("WhatsNewContent", () => {
	it("renders subtitle with fromVersion", () => {
		renderWithProviders(
			<WhatsNewContent
				config={makeConfig()}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(screen.getByText("Changes since v0.9.0")).toBeInTheDocument();
	});

	it("renders default support section when none provided", () => {
		renderWithProviders(
			<WhatsNewContent
				config={makeConfig()}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(screen.getByText("Support the development of this plugin")).toBeInTheDocument();
		expect(screen.getByText("Support my work")).toBeInTheDocument();
	});

	it("renders custom support section when provided", () => {
		const config = makeConfig({
			supportSection: {
				heading: "Help us grow",
				description: "Your support matters.",
				cta: { text: "Donate now", href: "https://example.com/donate" },
			},
		});

		renderWithProviders(
			<WhatsNewContent config={config} plugin={mockPlugin} fromVersion="0.9.0" toVersion="1.0.0" close={vi.fn()} />
		);

		expect(screen.getByText("Help us grow")).toBeInTheDocument();
		expect(screen.getByText("Your support matters.")).toBeInTheDocument();
		expect(screen.getByText("Donate now")).toBeInTheDocument();
	});

	it("renders custom support section without CTA when omitted", () => {
		const config = makeConfig({
			supportSection: { heading: "Thanks!", description: "We appreciate you." },
		});

		renderWithProviders(
			<WhatsNewContent config={config} plugin={mockPlugin} fromVersion="0.9.0" toVersion="1.0.0" close={vi.fn()} />
		);

		expect(screen.getByText("Thanks!")).toBeInTheDocument();
		expect(screen.getByText("We appreciate you.")).toBeInTheDocument();
	});

	it("renders all footer buttons", () => {
		const config = makeConfig({
			links: {
				support: "#",
				changelog: "#",
				documentation: "#",
				github: "#",
				productPage: "https://example.com/product",
			},
		});

		renderWithProviders(
			<WhatsNewContent config={config} plugin={mockPlugin} fromVersion="0.9.0" toVersion="1.0.0" close={vi.fn()} />
		);

		expect(screen.getByText("GitHub")).toBeInTheDocument();
		expect(screen.getByText("Changelog")).toBeInTheDocument();
		expect(screen.getByText("Documentation")).toBeInTheDocument();
		expect(screen.getByText("Other Plugins")).toBeInTheDocument();
		expect(screen.getByText("YouTube")).toBeInTheDocument();
		expect(screen.getByText("Product Page")).toBeInTheDocument();
	});

	it("hides Product Page button when link not provided", () => {
		renderWithProviders(
			<WhatsNewContent
				config={makeConfig()}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(screen.queryByText("Product Page")).not.toBeInTheDocument();
	});

	it("shows empty message when no changelog sections found", () => {
		mockedGetChangelogSince.mockReturnValue([]);

		renderWithProviders(
			<WhatsNewContent
				config={makeConfig()}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(screen.getByText("No significant changes found in this update.")).toBeInTheDocument();
	});

	it("renders changelog content div when sections exist", () => {
		mockedGetChangelogSince.mockReturnValue([{ heading: "## 1.0.0", content: "- Feature" }]);

		const { container } = renderWithProviders(
			<WhatsNewContent
				config={makeConfig()}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(container.querySelector(".test-whats-new-content")).toBeInTheDocument();
		expect(screen.queryByText("No significant changes found in this update.")).not.toBeInTheDocument();
	});

	it("uses cssPrefix for class names", () => {
		const { container } = renderWithProviders(
			<WhatsNewContent
				config={makeConfig({ cssPrefix: "myprefix" })}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(container.querySelector(".myprefix-whats-new-subtitle")).toBeInTheDocument();
		expect(container.querySelector(".myprefix-whats-new-support")).toBeInTheDocument();
	});

	it("uses cssPrefix for testId", () => {
		renderWithProviders(
			<WhatsNewContent
				config={makeConfig({ cssPrefix: "myprefix" })}
				plugin={mockPlugin}
				fromVersion="0.9.0"
				toVersion="1.0.0"
				close={vi.fn()}
			/>
		);

		expect(screen.getByTestId("myprefix-whats-new-modal")).toBeInTheDocument();
	});
});
