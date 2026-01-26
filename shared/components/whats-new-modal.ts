import type { App, Plugin } from "obsidian";
import { MarkdownRenderer, Modal } from "obsidian";
import { formatChangelogSections, getChangelogSince } from "../string";

/**
 * Default URLs for the What's New modal.
 * These can be overridden in the config.
 */
export const DEFAULT_WHATS_NEW_LINKS = {
	/**
	 * Default tools page showcasing all plugins and productivity software.
	 */
	TOOLS: "https://matejvavroproductivity.com/tools/",

	/**
	 * Default YouTube channel with Obsidian tutorials and productivity tips.
	 * Includes subscription confirmation parameter.
	 */
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

export interface WhatsNewModalConfig {
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
		 * URL to tools page showcasing all plugins and productivity tools.
		 * Defaults to DEFAULT_WHATS_NEW_LINKS.TOOLS if not provided.
		 */
		tools?: string;

		/**
		 * URL to YouTube channel with tutorials and productivity tips.
		 * Defaults to DEFAULT_WHATS_NEW_LINKS.YOUTUBE if not provided.
		 */
		youtube?: string;
	};
}

/**
 * Generic "What's New" modal that displays changelog entries between versions.
 * Supports custom CSS prefixes, plugin names, and configurable links.
 *
 * ## CSS Classes
 *
 * This modal uses the following CSS classes (with your custom prefix).
 * Replace `{prefix}` with your `cssPrefix` value (e.g., "my-plugin").
 *
 * ### Main Container
 * - `.{prefix}-whats-new-modal` - Applied to the main content element
 * - `.{prefix}-whats-new-modal .modal` - Modal dialog styling (max-width, width)
 *
 * ### Title and Subtitle
 * - Modal title is set via `setTitle()` - Obsidian handles the styling and X close button
 * - `.{prefix}-whats-new-subtitle` - Subtitle text ("Changes since vX.X.X")
 *
 * ### Support Section
 * - `.{prefix}-whats-new-support` - Support section container
 *   - Contains donation, tools, and YouTube links
 *   - Should have background, padding, border-radius
 * - `.{prefix}-whats-new-support h3` - Support section heading
 * - `.{prefix}-whats-new-support p` - Support section paragraph text (one per row)
 * - `.{prefix}-whats-new-support a` - Links in support section (consistent styling)
 * - `.{prefix}-whats-new-support a:hover` - Link hover state
 *
 * ### Changelog Content
 * - `.{prefix}-whats-new-content` - Changelog content container
 *   - Should have max-height, overflow-y: auto for scrolling
 * - `.{prefix}-whats-new-content h2` - Version headings in changelog
 * - `.{prefix}-whats-new-content h3` - Section headings in changelog
 * - `.{prefix}-whats-new-content ul` - Changelog lists
 * - `.{prefix}-whats-new-content li` - Changelog list items
 * - `.{prefix}-whats-new-content code` - Inline code in changelog
 * - `.{prefix}-whats-new-content pre` - Code blocks in changelog
 * - `.{prefix}-whats-new-content a.external-link` - External links (auto-added)
 * - `.{prefix}-whats-new-empty` - Empty state message
 *
 * ### Sticky Footer
 * - `.{prefix}-whats-new-sticky-footer` - Footer container (should be sticky)
 *   - Has border-top to separate from content
 * - `.{prefix}-whats-new-buttons` - Button container
 * - `.{prefix}-whats-new-buttons button` - Individual buttons
 *
 * ## Example CSS Implementation
 *
 * ```css
 * // Main Container
 * .my-plugin-whats-new-modal .modal {
 *   max-width: 800px;
 *   width: 90%;
 * }
 *
 * // Plugin Name Link (in title)
 * .my-plugin-whats-new-plugin-name {
 *   color: var(--link-color);
 *   text-decoration: none;
 *   transition: all 0.2s ease;
 *   position: relative;
 *   font-weight: 600;
 * }
 *
 * .my-plugin-whats-new-plugin-name:hover {
 *   color: var(--link-color-hover);
 *   text-decoration: none;
 * }
 *
 * .my-plugin-whats-new-plugin-name::after {
 *   content: '';
 *   position: absolute;
 *   bottom: -2px;
 *   left: 0;
 *   width: 0;
 *   height: 2px;
 *   background-color: var(--interactive-accent);
 *   transition: width 0.3s ease;
 * }
 *
 * .my-plugin-whats-new-plugin-name:hover::after {
 *   width: 100%;
 * }
 *
 * // Subtitle
 * .my-plugin-whats-new-subtitle {
 *   color: var(--text-muted);
 *   font-size: 0.9rem;
 *   margin: 0 0 1rem 0;
 * }
 *
 * // Support Section (with donation, tools, and YouTube links)
 * .my-plugin-whats-new-support {
 *   margin: 0 0 1rem 0;
 *   padding: 1rem;
 *   background-color: var(--background-secondary);
 *   border-radius: 8px;
 * }
 *
 * .my-plugin-whats-new-support h3 {
 *   margin-top: 0;
 *   margin-bottom: 0.5rem;
 *   font-size: 1rem;
 * }
 *
 * .my-plugin-whats-new-support p {
 *   margin: 0.5rem 0;
 *   color: var(--text-normal);
 * }
 *
 * .my-plugin-whats-new-support a {
 *   color: var(--link-color);
 *   text-decoration: none;
 *   transition: all 0.2s ease;
 *   position: relative;
 * }
 *
 * .my-plugin-whats-new-support a:hover {
 *   color: var(--link-color-hover);
 *   text-decoration: none;
 * }
 *
 * .my-plugin-whats-new-support a::after {
 *   content: '';
 *   position: absolute;
 *   bottom: -2px;
 *   left: 0;
 *   width: 0;
 *   height: 2px;
 *   background-color: var(--interactive-accent);
 *   transition: width 0.3s ease;
 * }
 *
 * .my-plugin-whats-new-support a:hover::after {
 *   width: 100%;
 * }
 *
 * // Changelog Content (Scrollable Area)
 * .my-plugin-whats-new-content {
 *   max-height: 400px;
 *   overflow-y: auto;
 *   margin-bottom: 1rem;
 *   padding-right: 0.5rem;
 *   border-radius: 8px;
 * }
 *
 * .my-plugin-whats-new-content h2 {
 *   font-size: 1.3rem;
 *   margin-top: 1.5rem;
 *   margin-bottom: 0.5rem;
 *   color: var(--text-accent);
 * }
 *
 * .my-plugin-whats-new-content h3 {
 *   font-size: 1.1rem;
 *   margin-top: 1rem;
 *   margin-bottom: 0.5rem;
 * }
 *
 * .my-plugin-whats-new-content ul {
 *   padding-left: 1.5rem;
 * }
 *
 * .my-plugin-whats-new-content li {
 *   margin-bottom: 0.5rem;
 *   line-height: 1.6;
 * }
 *
 * .my-plugin-whats-new-content code {
 *   background: var(--code-background);
 *   padding: 0.2em 0.4em;
 *   border-radius: 3px;
 *   font-size: 0.9em;
 * }
 *
 * .my-plugin-whats-new-content pre {
 *   background: var(--code-background);
 *   padding: 1rem;
 *   border-radius: 6px;
 *   overflow-x: auto;
 * }
 *
 * .my-plugin-whats-new-content a.external-link {
 *   color: var(--link-external-color);
 * }
 *
 * .my-plugin-whats-new-content a.external-link::after {
 *   content: "↗";
 *   margin-left: 0.2em;
 *   font-size: 0.8em;
 * }
 *
 * .my-plugin-whats-new-empty {
 *   text-align: center;
 *   color: var(--text-muted);
 *   padding: 2rem;
 *   font-style: italic;
 * }
 *
 * // Sticky Footer
 * .my-plugin-whats-new-sticky-footer {
 *   position: sticky;
 *   bottom: 0;
 *   background: var(--background-primary);
 *   padding-top: 0.75rem;
 *   margin-top: 0;
 *   z-index: 10;
 *   border-top: 1px solid var(--background-modifier-border);
 * }
 *
 * .my-plugin-whats-new-buttons {
 *   display: flex;
 *   gap: 0.5rem;
 *   justify-content: space-between;
 *   flex-wrap: wrap;
 *   padding-bottom: 0.5rem;
 *   width: 100%;
 * }
 *
 * .my-plugin-whats-new-buttons button {
 *   flex: 1;
 *   min-width: 0;
 *   padding: 0.5rem 1rem;
 *   border-radius: 4px;
 *   cursor: pointer;
 *   border: 1px solid var(--background-modifier-border);
 *   background: var(--interactive-normal);
 *   color: var(--text-normal);
 *   transition: all 0.2s ease;
 *   text-align: center;
 * }
 *
 * .my-plugin-whats-new-buttons button:hover {
 *   background: var(--interactive-hover);
 *   border-color: var(--interactive-accent);
 *   transform: translateY(-1px);
 *   box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
 * }
 *
 * .my-plugin-whats-new-buttons button:active {
 *   transform: translateY(0);
 *   box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
 * }
 * ```
 *
 * @example
 * ```typescript
 * const modal = new WhatsNewModal(app, plugin, {
 *   cssPrefix: "my-plugin",
 *   pluginName: "My Plugin",
 *   changelogContent: rawChangelog,
 *   links: {
 *     support: "https://...",
 *     changelog: "https://...",
 *     documentation: "https://..."
 *   }
 * }, "1.0.0", "2.0.0");
 * modal.open();
 * ```
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

	async onOpen() {
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

		const exploreText = supportSection.createEl("p");
		exploreText.createSpan({ text: "You can also explore my " });
		exploreText.createEl("a", {
			text: "other Obsidian plugins and productivity tools",
			href: this.config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS,
		});
		exploreText.createSpan({ text: ", or follow my " });
		exploreText.createEl("a", {
			text: "YouTube channel",
			href: this.config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE,
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
			window.open(this.config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS, "_blank");
		});

		// YouTube button
		const youtubeBtn = buttonContainer.createEl("button", {
			text: "YouTube",
		});
		youtubeBtn.addEventListener("click", () => {
			window.open(this.config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE, "_blank");
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
