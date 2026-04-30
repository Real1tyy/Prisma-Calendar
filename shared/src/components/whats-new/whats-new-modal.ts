import type { App, Plugin } from "obsidian";
import { MarkdownRenderer } from "obsidian";

import { formatChangelogSections, getChangelogSince } from "../../utils/string";
import { showModal } from "../component-renderer/modal";
import { injectWhatsNewStyles } from "./whats-new-styles";

const LINES_PER_PAGE = 15;

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
		 * URL to the plugin's product page. When provided, adds a "Product Page" footer button.
		 */
		productPage?: string;

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
 * Makes external links in rendered markdown clickable by adding click handlers.
 * Handles both absolute URLs (http/https) and relative URLs (starting with /).
 * Relative URLs are resolved against the documentation base URL.
 */
export function makeExternalLinksClickable(container: HTMLElement, documentationBaseUrl: string): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");

	Array.from(links).forEach((link) => {
		const href = link.getAttribute("href");
		if (!href) return;

		let finalUrl: string | null = null;

		if (href.startsWith("http://") || href.startsWith("https://")) {
			finalUrl = href;
		} else if (href.startsWith("/")) {
			const normalizedBase = documentationBaseUrl.endsWith("/")
				? documentationBaseUrl.slice(0, -1)
				: documentationBaseUrl;
			finalUrl = `${normalizedBase}${href}`;
		}

		if (finalUrl) {
			link.addEventListener("click", (event: MouseEvent) => {
				event.preventDefault();
				window.open(finalUrl, "_blank");
			});

			link.classList.add("external-link");
		}
	});
}

/**
 * Generic "What's New" modal that displays changelog entries between versions.
 * Supports custom CSS prefixes, plugin names, and configurable links.
 * Styles are injected automatically via `injectWhatsNewStyles`.
 */
export function showWhatsNewModal(
	app: App,
	plugin: Plugin,
	config: WhatsNewModalConfig,
	fromVersion: string,
	toVersion: string
): void {
	injectWhatsNewStyles(config.cssPrefix);

	const cls = (suffix: string) => `${config.cssPrefix}-${suffix}`;

	showModal({
		app,
		cls: cls("whats-new-modal"),
		title: " ",
		render: async (contentEl, ctx) => {
			const isFullChangelog = fromVersion === "0.0.0";
			const titleEl = ctx.type === "modal" ? ctx.modalEl.querySelector<HTMLElement>(".modal-title") : null;
			if (titleEl) {
				titleEl.empty();

				const pluginNameLink = titleEl.createEl("a", {
					text: config.pluginName,
					cls: cls("whats-new-plugin-name"),
					href: "#",
				});

				pluginNameLink.addEventListener("click", (e: MouseEvent) => {
					e.preventDefault();
					window.open(config.links.github, "_blank");
				});

				titleEl.createSpan({
					text: isFullChangelog ? " Changelog" : ` updated to v${toVersion}`,
				});
			}

			if (!isFullChangelog) {
				contentEl.createEl("p", {
					text: `Changes since v${fromVersion}`,
					cls: cls("whats-new-subtitle"),
				});
			}

			const supportSection = contentEl.createDiv({
				cls: cls("whats-new-support"),
			});

			const headingText = config.supportSection
				? config.supportSection.heading
				: "Support the development of this plugin";

			const supportHeader = supportSection.createDiv({ cls: cls("whats-new-support-header") });
			supportHeader.createEl("h3", { text: headingText });
			const chevron = supportHeader.createSpan({ cls: cls("whats-new-support-chevron"), text: "▼" });

			const supportBody = supportSection.createDiv({ cls: cls("whats-new-support-body") });

			supportHeader.addEventListener("click", () => {
				const collapsed = supportBody.classList.toggle(cls("whats-new-support-collapsed"));
				chevron.textContent = collapsed ? "▶" : "▼";
			});

			if (config.supportSection) {
				const { description, cta } = config.supportSection;
				supportBody.createEl("p", { text: description });
				if (cta) {
					const ctaText = supportBody.createEl("p");
					ctaText.createSpan({ text: "👉 " });
					ctaText.createEl("a", { text: cta.text, href: cta.href });
				}
			} else {
				const introText = supportBody.createEl("p");
				introText.setText(
					"If this plugin saves you time or improves how you work in Obsidian, consider supporting its development. Your support helps fund ongoing maintenance, new features, and long-term stability."
				);

				const supportLinkText = supportBody.createEl("p");
				supportLinkText.createSpan({ text: "👉 " });
				supportLinkText.createEl("a", {
					text: "Support my work",
					href: config.links.support,
				});
			}

			const exploreText = supportBody.createEl("p");
			exploreText.createSpan({ text: "You can also explore my " });
			exploreText.createEl("a", {
				text: "other Obsidian plugins and productivity tools",
				href: config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS,
			});
			exploreText.createSpan({ text: ", or follow my " });
			exploreText.createEl("a", {
				text: "YouTube channel",
				href: config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE,
			});
			exploreText.createSpan({
				text: " for in-depth tutorials and workflow ideas.",
			});

			const changelogSections = getChangelogSince(config.changelogContent, fromVersion, toVersion);

			if (changelogSections.length === 0) {
				contentEl.createEl("p", {
					text: "No significant changes found in this update.",
					cls: cls("whats-new-empty"),
				});
			} else {
				const changelogContainer = contentEl.createDiv({
					cls: cls("whats-new-content"),
				});

				let renderedCount = 0;
				let loadMoreBtn: HTMLButtonElement | null = null;
				let isRendering = false;

				const countLines = (content: string): number =>
					content.split("\n").filter((line) => line.trim().length > 0).length;

				const renderNextBatch = async (): Promise<void> => {
					if (isRendering) return;
					isRendering = true;

					let linesAccum = 0;
					let end = renderedCount;
					while (end < changelogSections.length) {
						const sectionLines = countLines(changelogSections[end].content);
						if (linesAccum > 0 && linesAccum + sectionLines > LINES_PER_PAGE) break;
						linesAccum += sectionLines;
						end++;
					}
					if (end === renderedCount && end < changelogSections.length) end++;

					const batch = changelogSections.slice(renderedCount, end);
					const batchMarkdown = formatChangelogSections(batch);

					const batchContainer = changelogContainer.createDiv();
					// eslint-disable-next-line obsidianmd/no-plugin-as-component -- short-lived modal, cleaned up on close
					await MarkdownRenderer.render(app, batchMarkdown, batchContainer, "/", plugin);
					makeExternalLinksClickable(batchContainer, config.links.documentation);

					renderedCount = end;

					const remaining = changelogSections.length - renderedCount;
					if (remaining > 0) {
						if (!loadMoreBtn) {
							loadMoreBtn = changelogContainer.createEl("button", {
								cls: cls("whats-new-load-more"),
							});
							loadMoreBtn.addEventListener("click", () => void renderNextBatch());
						} else {
							changelogContainer.appendChild(loadMoreBtn);
						}
						loadMoreBtn.textContent = `Load more (${remaining} versions remaining)`;
					} else if (loadMoreBtn) {
						loadMoreBtn.remove();
						loadMoreBtn = null;
					}

					isRendering = false;
				};

				await renderNextBatch();
			}

			const stickyFooter = contentEl.createDiv({
				cls: cls("whats-new-sticky-footer"),
			});

			const buttonContainer = stickyFooter.createDiv({
				cls: cls("whats-new-buttons"),
			});

			if (config.links.productPage) {
				const productPageBtn = buttonContainer.createEl("button", {
					text: "Product Page",
				});
				productPageBtn.addEventListener("click", () => {
					window.open(config.links.productPage, "_blank");
				});
			}

			const githubBtn = buttonContainer.createEl("button", {
				text: "GitHub",
			});
			githubBtn.addEventListener("click", () => {
				window.open(config.links.github, "_blank");
			});

			const changelogBtn = buttonContainer.createEl("button", {
				text: "Changelog",
			});
			changelogBtn.addEventListener("click", () => {
				window.open(config.links.changelog, "_blank");
			});

			const docsBtn = buttonContainer.createEl("button", {
				text: "Documentation",
			});
			docsBtn.addEventListener("click", () => {
				window.open(config.links.documentation, "_blank");
			});

			const toolsBtn = buttonContainer.createEl("button", {
				text: "Other Plugins",
			});
			toolsBtn.addEventListener("click", () => {
				window.open(config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS, "_blank");
			});

			const youtubeBtn = buttonContainer.createEl("button", {
				text: "YouTube",
			});
			youtubeBtn.addEventListener("click", () => {
				window.open(config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE, "_blank");
			});
		},
	});
}
