import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual };
});

import {
	SettingsNavigation,
	type SettingsNavigationConfig,
	type SettingsSection,
} from "../../src/components/primitives/settings-navigation";

function createSection(overrides?: Partial<SettingsSection>): SettingsSection {
	return {
		id: "general",
		label: "General",
		display: vi.fn(),
		hide: vi.fn(),
		...overrides,
	};
}

function createConfig(overrides?: Partial<SettingsNavigationConfig>): SettingsNavigationConfig {
	return {
		cssPrefix: "test-",
		sections: [
			createSection({ id: "general", label: "General" }),
			createSection({ id: "appearance", label: "Appearance" }),
			createSection({ id: "advanced", label: "Advanced" }),
		],
		...overrides,
	};
}

describe("SettingsNavigation", () => {
	let containerEl: HTMLElement;

	beforeEach(() => {
		containerEl = document.createElement("div");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("display", () => {
		it("should render navigation buttons for each section", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const buttons = containerEl.querySelectorAll("button");
			expect(buttons).toHaveLength(3);
			expect(buttons[0].textContent).toBe("General");
			expect(buttons[1].textContent).toBe("Appearance");
			expect(buttons[2].textContent).toBe("Advanced");
		});

		it("should mark the first section as active by default", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const buttons = containerEl.querySelectorAll("button");
			expect(buttons[0].classList.contains("test-active")).toBe(true);
			expect(buttons[1].classList.contains("test-active")).toBe(false);
		});

		it("should display the first section content", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			expect(config.sections[0].display).toHaveBeenCalled();
			expect(config.sections[1].display).not.toHaveBeenCalled();
		});

		it("should create a content container", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const content = containerEl.querySelector(".test-settings-content");
			expect(content).toBeTruthy();
		});

		it("should clear container before rendering", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			containerEl.createEl("div", { text: "stale" });
			nav.display(containerEl);

			expect(containerEl.textContent).not.toContain("stale");
		});

		it("should render a search input", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const searchInput = containerEl.querySelector("input");
			expect(searchInput).toBeTruthy();
			expect(searchInput?.placeholder).toBe("Search settings...");
		});
	});

	describe("section switching", () => {
		it("should switch active section on button click", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const buttons = containerEl.querySelectorAll("button");
			(buttons[1] as HTMLButtonElement).click();

			expect(buttons[0].classList.contains("test-active")).toBe(false);
			expect(buttons[1].classList.contains("test-active")).toBe(true);
		});

		it("should display the selected section content", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);
			vi.clearAllMocks();

			const buttons = containerEl.querySelectorAll("button");
			(buttons[2] as HTMLButtonElement).click();

			expect(config.sections[2].display).toHaveBeenCalled();
		});

		it("should call hide on previous section when switching", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const buttons = containerEl.querySelectorAll("button");
			(buttons[1] as HTMLButtonElement).click();

			expect(config.sections[0].hide).toHaveBeenCalled();
		});
	});

	describe("hide", () => {
		it("should call hide on the active section", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);
			nav.hide();

			expect(config.sections[0].hide).toHaveBeenCalled();
		});

		it("should call hide on the correct section after switching", () => {
			const config = createConfig();
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);
			const buttons = containerEl.querySelectorAll("button");
			(buttons[2] as HTMLButtonElement).click();

			vi.clearAllMocks();
			nav.hide();

			expect(config.sections[2].hide).toHaveBeenCalled();
			expect(config.sections[0].hide).not.toHaveBeenCalled();
		});

		it("should not throw when section has no hide method", () => {
			const config = createConfig({
				sections: [createSection({ hide: undefined })],
			});
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			expect(() => nav.hide()).not.toThrow();
		});
	});

	describe("footer links", () => {
		it("should render footer links when provided", () => {
			const config = createConfig({
				footerLinks: [
					{ text: "Documentation", href: "https://example.com/docs" },
					{ text: "Support", href: "https://example.com/support" },
				],
			});
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const links = containerEl.querySelectorAll("a");
			expect(links).toHaveLength(2);
			expect(links[0].textContent).toBe("Documentation");
			expect(links[0].href).toBe("https://example.com/docs");
			expect(links[1].textContent).toBe("Support");
		});

		it("should not render footer when no links are provided", () => {
			const config = createConfig({ footerLinks: [] });
			const nav = new SettingsNavigation(config);

			nav.display(containerEl);

			const footer = containerEl.querySelector(".test-settings-footer");
			expect(footer).toBeNull();
		});
	});
});
