import type { App, Plugin } from "obsidian";
import { MarkdownRenderer, Modal } from "obsidian";

import { formatChangelogSections, getChangelogSince } from "../../utils/string";
import { buildUtmUrl, type PluginSlug } from "../../utils/utm";
import { injectWhatsNewStyles } from "./whats-new-styles";

/**
 * Raw fallback URLs used only as input to buildUtmUrl() when the caller
 * does not provide their own pre-UTM'd `tools` / `youtube` links.
 * Never use these values directly as hrefs — always run them through buildUtmUrl().
 */
const DEFAULT_TOOLS_URL = "https://matejvavroproductivity.com/tools/";
const DEFAULT_YOUTUBE_URL = "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1";

export interface WhatsNewModalConfig {
	/**
	 * Plugin slug, used to UTM-wrap the default `tools` and `youtube` fallback URLs
	 * when the caller does not provide their own pre-UTM'd versions.
	 */
	slug: PluginSlug;

	/**
	 * The CSS class prefix/suffix to use for styling.
	 * Example: "custom-calendar" will generate classes like "custom-calendar-whats-new-modal"
	 */
	cssPrefix: string;

	/**
	 * Display name of the plugin.
	 * Example: "Custom Calendar"
	 */
	pluginName: string;

	/**
	 * Raw changelog markdown content to parse.
	 */
	changelogContent: string;

	/**
	 * Links to external resources.
	 */
	links: {
		/**
		 * URL to support/donate page.
		 */
		support: string;

		/**
		 * URL to full changelog page.
		 */
		changelog: string;

		/**
		 * Base URL for documentation (used to resolve relative links in changelog).
		 * Example: "https://docs.example.com" or "https://docs.example.com/"
		 */
		documentation: string;

		/**
		 * URL to GitHub repository.
		 */
		github: string;

		/**
		 * URL to the plugin's product page. When provided, adds a "Product Page" footer button.
		 */
		productPage?: string;

		/**
		 * URL to tools page showcasing all plugins and productivity tools.
		 * Must be pre-UTM'd. Falls back to the default tools URL (UTM-wrapped with `slug`) when omitted.
		 */
		tools?: string;

		/**
		 * URL to YouTube channel with tutorials and productivity tips.
		 * Must be pre-UTM'd. Falls back to the default YouTube URL (UTM-wrapped with `slug`) when omitted.
		 */
		youtube?: string;
	};

	/**
	 * Override the support section content. When provided, replaces the default
	 * support section entirely with custom heading, description, and CTA.
	 */
	supportSection?: {
		heading: string;
		description: string;
		cta?: { text: string; href: string };
	};
}

/**
 * Generic "What's New" modal that displays changelog entries between versions.
 * Supports custom CSS prefixes, plugin names, and configurable links.
 */
export class WhatsNewModal extends Modal {
	constructor(
		app: App,
		private plugin: Plugin,
		private config: WhatsNewModalConfig,
		private fromVersion: string,
		private toVersion: string
	) {
		super(app);
	}

	/**
	 * Helper to create CSS class names with the configured prefix.
	 */
	private cls(suffix: string): string {
		return `${this.config.cssPrefix}-${suffix}`;
	}

	private get toolsUrl(): string {
		return this.config.links.tools ?? buildUtmUrl(DEFAULT_TOOLS_URL, this.config.slug, "plugin", "whats_new", "tools");
	}

	private get youtubeUrl(): string {
		return (
			this.config.links.youtube ?? buildUtmUrl(DEFAULT_YOUTUBE_URL, this.config.slug, "plugin", "whats_new", "youtube")
		);
	}

	/**
	 * Helper to add CSS class to an element.
	 */
	private addCls(el: HTMLElement, suffix: string): void {
		el.classList.add(this.cls(suffix));
	}

	/**
	 * Makes external links in rendered markdown clickable by adding click handlers.
	 * Handles both absolute URLs (http/https) and relative URLs (starting with /).
	 * Relative URLs are resolved against the documentation base URL.
	 */
	private makeExternalLinksClickable(container: HTMLElement): void {
		const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");

		// Convert NodeList to Array for iteration
		Array.from(links).forEach((link) => {
			const href = link.getAttribute("href");
			if (!href) return;

			let finalUrl: string | null = null;

			// Handle absolute HTTP(S) links
			if (href.startsWith("http://") || href.startsWith("https://")) {
				finalUrl = href;
			}
			// Handle relative links (starting with /)
			else if (href.startsWith("/")) {
				// Get base documentation URL and ensure proper slash handling
				const baseUrl = this.config.links.documentation;
				const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
				finalUrl = `${normalizedBase}${href}`;
			}

			// Add click handler for external links
			if (finalUrl) {
				link.addEventListener("click", (event: MouseEvent) => {
					event.preventDefault();
					window.open(finalUrl, "_blank");
				});

				// Add visual indicator that it's an external link
				link.classList.add("external-link");
			}
		});
	}

	override async onOpen() {
		injectWhatsNewStyles(this.config.cssPrefix);

		const { contentEl } = this;
		contentEl.empty();

		this.addCls(contentEl, "whats-new-modal");

		this.setTitle("");

		const titleEl = this.titleEl;
		titleEl.empty();

		const pluginNameLink = titleEl.createEl("a", {
			text: this.config.pluginName,
			cls: this.cls("whats-new-plugin-name"),
			href: "#",
		});

		pluginNameLink.addEventListener("click", (e) => {
			e.preventDefault();
			window.open(this.config.links.github, "_blank");
		});

		titleEl.createSpan({
			text: ` updated to v${this.toVersion}`,
		});

		// Subtitle
		contentEl.createEl("p", {
			text: `Changes since v${this.fromVersion}`,
			cls: this.cls("whats-new-subtitle"),
		});

		// Support section
		const supportSection = contentEl.createDiv({
			cls: this.cls("whats-new-support"),
		});

		if (this.config.supportSection) {
			const { heading, description, cta } = this.config.supportSection;
			supportSection.createEl("h3", { text: heading });
			supportSection.createEl("p", { text: description });
			if (cta) {
				const ctaText = supportSection.createEl("p");
				ctaText.createSpan({ text: "👉 " });
				ctaText.createEl("a", { text: cta.text, href: cta.href });
			}
		} else {
			supportSection.createEl("h3", { text: "Support the development of this plugin" });

			const introText = supportSection.createEl("p");
			introText.setText(
				"If this plugin saves you time or improves how you work in Obsidian, consider supporting its development. Your support helps fund ongoing maintenance, new features, and long-term stability."
			);

			const supportLinkText = supportSection.createEl("p");
			supportLinkText.createSpan({ text: "👉 " });
			supportLinkText.createEl("a", {
				text: "Support my work",
				href: this.config.links.support,
			});
		}

		const exploreText = supportSection.createEl("p");
		exploreText.createSpan({ text: "You can also explore my " });
		exploreText.createEl("a", {
			text: "other Obsidian plugins and productivity tools",
			href: this.toolsUrl,
		});
		exploreText.createSpan({ text: ", or follow my " });
		exploreText.createEl("a", {
			text: "YouTube channel",
			href: this.youtubeUrl,
		});
		exploreText.createSpan({
			text: " for in-depth tutorials and workflow ideas.",
		});

		// Changelog content
		const changelogSections = getChangelogSince(this.config.changelogContent, this.fromVersion, this.toVersion);

		if (changelogSections.length === 0) {
			contentEl.createEl("p", {
				text: "No significant changes found in this update.",
				cls: this.cls("whats-new-empty"),
			});
		} else {
			const changelogContainer = contentEl.createDiv({
				cls: this.cls("whats-new-content"),
			});

			const markdownContent = formatChangelogSections(changelogSections);

			await MarkdownRenderer.render(this.app, markdownContent, changelogContainer, "/", this.plugin);

			// Make external links clickable
			this.makeExternalLinksClickable(changelogContainer);
		}

		// Sticky footer section (hr + buttons)
		const stickyFooter = contentEl.createDiv({
			cls: this.cls("whats-new-sticky-footer"),
		});

		// Action buttons
		const buttonContainer = stickyFooter.createDiv({
			cls: this.cls("whats-new-buttons"),
		});

		if (this.config.links.productPage) {
			const productPageBtn = buttonContainer.createEl("button", {
				text: "Product Page",
			});
			productPageBtn.addEventListener("click", () => {
				window.open(this.config.links.productPage!, "_blank");
			});
		}

		// GitHub button
		const githubBtn = buttonContainer.createEl("button", {
			text: "GitHub",
		});
		githubBtn.addEventListener("click", () => {
			window.open(this.config.links.github, "_blank");
		});

		// Full changelog button
		const changelogBtn = buttonContainer.createEl("button", {
			text: "Changelog",
		});
		changelogBtn.addEventListener("click", () => {
			window.open(this.config.links.changelog, "_blank");
		});

		// Documentation button
		const docsBtn = buttonContainer.createEl("button", {
			text: "Documentation",
		});
		docsBtn.addEventListener("click", () => {
			window.open(this.config.links.documentation, "_blank");
		});

		// Tools button
		const toolsBtn = buttonContainer.createEl("button", {
			text: "Other Plugins",
		});
		toolsBtn.addEventListener("click", () => {
			window.open(this.toolsUrl, "_blank");
		});

		// YouTube button
		const youtubeBtn = buttonContainer.createEl("button", {
			text: "YouTube",
		});
		youtubeBtn.addEventListener("click", () => {
			window.open(this.youtubeUrl, "_blank");
		});
	}

	override onClose() {
		this.contentEl.empty();
	}
}
