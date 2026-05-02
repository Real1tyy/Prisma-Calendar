import { getChangelogSince } from "@real1ty-obsidian-plugins";
import { screen } from "@testing-library/react";
import type { Plugin } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type { WhatsNewModalConfig } from "../../src/modals/whats-new-modal";
import { makeExternalLinksClickable, WhatsNewContent } from "../../src/modals/whats-new-modal";
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

const DOCS_BASE = "https://example.com/docs?utm_campaign=test&utm_source=plugin&utm_medium=whats_new&utm_content=docs";

function buildContainer(...anchors: { href?: string; dataHref?: string; text: string }[]): HTMLDivElement {
	const container = document.createElement("div");
	for (const { href, dataHref, text } of anchors) {
		const a = document.createElement("a");
		if (href) a.setAttribute("href", href);
		if (dataHref) a.setAttribute("data-href", dataHref);
		a.textContent = text;
		container.appendChild(a);
	}
	return container;
}

function getLink(container: HTMLElement, text: string): HTMLAnchorElement {
	const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
	const link = links.find((a) => a.textContent === text);
	if (!link) throw new Error(`Link "${text}" not found`);
	return link;
}

describe("makeExternalLinksClickable", () => {
	it("makes absolute http links clickable and adds external-link class", () => {
		const container = buildContainer({ href: "https://youtu.be/abc", text: "Video" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		const link = getLink(container, "Video");
		expect(link).toHaveClass("external-link");
		link.click();
		expect(openSpy).toHaveBeenCalledWith("https://youtu.be/abc", "_blank");
	});

	it("resolves relative ./path.md links to absolute doc URLs with UTM", () => {
		const container = buildContainer({ href: "./quickstart.md", text: "Quick Start" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		const link = getLink(container, "Quick Start");
		expect(link).toHaveClass("external-link");
		link.click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("https://example.com/docs/quickstart");
		expect(opened).not.toContain(".md");
		expect(opened).toContain("utm_campaign=test");
		expect(opened).toContain("utm_content=quickstart");
	});

	it("resolves nested relative paths with fragment anchors", () => {
		const container = buildContainer({
			href: "./features/events/event-groups.md#series-shortcuts",
			text: "Groups",
		});
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "Groups").click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("/docs/features/events/event-groups");
		expect(opened).toContain("#series-shortcuts");
		expect(opened).not.toContain(".md");
	});

	it("resolves slash-prefixed paths against the clean base", () => {
		const container = buildContainer({ href: "/changelog", text: "Changelog" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "Changelog").click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("https://example.com/docs/changelog");
		expect(opened).toContain("utm_content=changelog");
	});

	it("reads data-href when href is absent (Obsidian internal links)", () => {
		const container = buildContainer({ dataHref: "quickstart", text: "QS" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "QS").click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("/docs/quickstart");
	});

	it("skips same-page anchor links", () => {
		const container = buildContainer({ href: "#section", text: "Anchor" });

		makeExternalLinksClickable(container, DOCS_BASE);

		expect(getLink(container, "Anchor")).not.toHaveClass("external-link");
	});

	it("skips mailto and non-http protocols", () => {
		const container = buildContainer(
			{ href: "mailto:test@example.com", text: "Email" },
			{ href: "obsidian://open?vault=test", text: "Obsidian" }
		);

		makeExternalLinksClickable(container, DOCS_BASE);

		expect(getLink(container, "Email")).not.toHaveClass("external-link");
		expect(getLink(container, "Obsidian")).not.toHaveClass("external-link");
	});

	it("skips anchors with no href or data-href", () => {
		const container = document.createElement("div");
		const a = document.createElement("a");
		a.textContent = "Empty";
		container.appendChild(a);

		makeExternalLinksClickable(container, DOCS_BASE);

		expect(a).not.toHaveClass("external-link");
	});

	it("preserves UTM campaign/source/medium from the base URL", () => {
		const container = buildContainer({ href: "./quickstart.md", text: "QS" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "QS").click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("utm_campaign=test");
		expect(opened).toContain("utm_source=plugin");
		expect(opened).toContain("utm_medium=whats_new");
	});

	it("derives utm_content from destination path segment", () => {
		const container = buildContainer(
			{ href: "./quickstart.md", text: "QS" },
			{ href: "./features/events/event-groups.md#anchor", text: "Groups" },
			{ href: "./configuration/general.md#license", text: "General" }
		);
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "QS").click();
		expect(openSpy.mock.calls[0][0] as string).toContain("utm_content=quickstart");

		getLink(container, "Groups").click();
		expect(openSpy.mock.calls[1][0] as string).toContain("utm_content=event_groups");

		getLink(container, "General").click();
		expect(openSpy.mock.calls[2][0] as string).toContain("utm_content=general");
	});

	it("does not add UTM params to absolute external URLs", () => {
		const container = buildContainer({ href: "https://youtu.be/abc", text: "YT" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, DOCS_BASE);

		getLink(container, "YT").click();
		expect(openSpy).toHaveBeenCalledWith("https://youtu.be/abc", "_blank");
	});

	it("handles base URL without UTM params", () => {
		const container = buildContainer({ href: "./quickstart.md", text: "QS" });
		const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

		makeExternalLinksClickable(container, "https://example.com/docs");

		getLink(container, "QS").click();
		const opened = openSpy.mock.calls[0][0] as string;
		expect(opened).toContain("https://example.com/docs/quickstart");
		expect(opened).toContain("utm_content=quickstart");
	});
});
