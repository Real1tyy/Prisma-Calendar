import {
	formatChangelogSections,
	getChangelogSince,
	resolveRelativeDocLinks,
	type VersionSection,
} from "@real1ty-obsidian-plugins";
import type { App, Plugin } from "obsidian";
import { MarkdownRenderer } from "obsidian";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { useApp } from "../contexts/app-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactModal } from "../show-react-modal";

const LINES_PER_PAGE = 15;

function buildWhatsNewStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}-whats-new-modal {
	max-width: 750px;
	width: 90%;
	height: 80vh;
}
.${p}-whats-new-modal .modal-title {
	text-align: center;
	width: 100%;
}
.${p}-whats-new-modal .modal-content {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	height: 100%;
}
.${p}-whats-new-modal .modal-content > [data-testid] {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}
.${p}-whats-new-plugin-name {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
	font-weight: 600;
}
.${p}-whats-new-plugin-name:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}-whats-new-plugin-name::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}-whats-new-plugin-name:hover::after {
	width: 100%;
}
.${p}-whats-new-subtitle {
	color: var(--text-muted);
	font-size: 0.9rem;
	margin: 0 0 1rem;
}
.${p}-whats-new-support {
	flex-shrink: 0;
	margin: 0;
	padding: 1rem 1.1rem;
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--background-secondary) 85%, var(--interactive-accent) 15%),
		var(--background-secondary) 70%
	);
	border-radius: 8px;
	border: 1px solid color-mix(in srgb, var(--interactive-accent) 15%, transparent);
}
.${p}-whats-new-support-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	cursor: pointer;
	user-select: none;
}
.${p}-whats-new-support-header h3 {
	margin: 0;
	font-size: 1rem;
	font-weight: 600;
	color: var(--text-accent);
}
.${p}-whats-new-support-chevron {
	font-size: 0.7rem;
	color: var(--text-muted);
	transition: transform 0.15s ease;
	flex-shrink: 0;
	padding: 0.2rem;
}
.${p}-whats-new-support-body {
	margin-top: 0.5rem;
	overflow: hidden;
	transition: max-height 0.2s ease, opacity 0.2s ease;
	max-height: 500px;
	opacity: 1;
}
.${p}-whats-new-support-collapsed {
	max-height: 0;
	opacity: 0;
	margin-top: 0;
}
.${p}-whats-new-support p {
	margin: 0.5rem 0;
	color: var(--text-normal);
}
.${p}-whats-new-support .${p}-whats-new-trial-highlight {
	display: inline-block;
	margin-top: 0.4rem;
	padding: 0.2rem 0.5rem;
	background: color-mix(in srgb, var(--interactive-accent) 8%, transparent);
	border: 1px solid color-mix(in srgb, var(--interactive-accent) 20%, transparent);
	border-radius: 5px;
	font-weight: 500;
	font-size: 0.85rem;
	color: var(--text-accent);
}
.${p}-whats-new-support a {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
}
.${p}-whats-new-support a:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}-whats-new-support a::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}-whats-new-support a:hover::after {
	width: 100%;
}
.${p}-whats-new-content {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	margin-bottom: 1rem;
	padding-right: 0.5rem;
	border-radius: 8px;
}
.${p}-whats-new-content h2 {
	font-size: 1.3rem;
	margin-top: 1.5rem;
	margin-bottom: 0.5rem;
	color: var(--text-accent);
}
.${p}-whats-new-content h3 {
	font-size: 1.1rem;
	margin-top: 1rem;
	margin-bottom: 0.5rem;
}
.${p}-whats-new-content ul { padding-left: 1.5rem; }
.${p}-whats-new-content li { margin-bottom: 0.5rem; line-height: 1.6; }
.${p}-whats-new-content code {
	background: var(--code-background);
	padding: 0.2em 0.4em;
	border-radius: 3px;
	font-size: 0.9em;
}
.${p}-whats-new-modal .${p}-whats-new-content code {
	color: var(--code-normal, var(--text-normal));
}
.${p}-whats-new-content pre {
	background: var(--code-background);
	padding: 1rem;
	border-radius: 6px;
	overflow-x: auto;
}
.${p}-whats-new-modal .${p}-whats-new-content a { color: var(--link-color); }
.${p}-whats-new-modal .${p}-whats-new-content a.external-link {
	color: var(--link-external-color, var(--link-color));
}
.${p}-whats-new-content a.external-link::after {
	content: "\\2197";
	margin-left: 0.2em;
	font-size: 0.8em;
}
.${p}-whats-new-empty {
	text-align: center;
	color: var(--text-muted);
	padding: 2rem;
	font-style: italic;
}
.${p}-whats-new-load-more {
	display: block;
	width: 100%;
	padding: 0.75rem 1rem;
	margin-top: 1rem;
	border-radius: 6px;
	cursor: pointer;
	border: 1px dashed var(--background-modifier-border);
	background: var(--background-secondary);
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	transition: all 0.2s ease;
	text-align: center;
}
.${p}-whats-new-load-more:hover {
	background: var(--background-modifier-hover);
	border-color: var(--interactive-accent);
	color: var(--text-normal);
}
.${p}-whats-new-sticky-footer {
	flex-shrink: 0;
	position: sticky;
	bottom: 0;
	background: var(--background-primary);
	padding-top: 0.75rem;
	margin-top: 0;
	z-index: 10;
	border-top: 1px solid var(--background-modifier-border);
}
.${p}-whats-new-buttons {
	display: flex;
	gap: 0.5rem;
	justify-content: space-between;
	flex-wrap: wrap;
	padding-bottom: 0.5rem;
	width: 100%;
}
.${p}-whats-new-buttons button {
	flex: 1;
	min-width: 0;
	padding: 0.5rem 1rem;
	border-radius: 4px;
	cursor: pointer;
	border: 1px solid var(--background-modifier-border);
	background: var(--interactive-normal);
	color: var(--text-normal);
	transition: all 0.2s ease;
	text-align: center;
}
.${p}-whats-new-buttons button:hover {
	background: var(--interactive-hover);
	border-color: var(--interactive-accent);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.${p}-whats-new-buttons button:active {
	transform: translateY(0);
	box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}
`;
}

export const DEFAULT_WHATS_NEW_LINKS = {
	TOOLS: "https://matejvavroproductivity.com/tools/",
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

export interface WhatsNewModalConfig {
	cssPrefix: string;
	pluginName: string;
	changelogContent: string;
	links: {
		support: string;
		changelog: string;
		documentation: string;
		github: string;
		productPage?: string;
		tools?: string;
		youtube?: string;
	};
	supportSection?: {
		heading: string;
		description: string;
		cta?: { text: string; href: string };
	};
}

interface WhatsNewContentProps {
	config: WhatsNewModalConfig;
	plugin: Plugin;
	fromVersion: string;
	toVersion: string;
	close: () => void;
}

function makeExternalLinksClickable(container: HTMLElement): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");
	for (const link of Array.from(links)) {
		const href = link.getAttribute("href");
		if (!href || !href.startsWith("http")) continue;

		link.addEventListener("click", (e: MouseEvent) => {
			e.preventDefault();
			window.open(href, "_blank");
		});
		link.classList.add("external-link");
	}
}

function countNonEmptyLines(content: string): number {
	return content.split("\n").filter((line) => line.trim().length > 0).length;
}

function computeNextBatch(sections: VersionSection[], renderedCount: number): VersionSection[] {
	let linesAccum = 0;
	let end = renderedCount;
	while (end < sections.length) {
		const sectionLines = countNonEmptyLines(sections[end].content);
		if (linesAccum > 0 && linesAccum + sectionLines > LINES_PER_PAGE) break;
		linesAccum += sectionLines;
		end++;
	}
	if (end === renderedCount && end < sections.length) end++;
	return sections.slice(renderedCount, end);
}

function FooterButton({ label, href }: { label: string; href: string }) {
	const handleClick = useCallback(() => window.open(href, "_blank"), [href]);
	return (
		<button type="button" onClick={handleClick}>
			{label}
		</button>
	);
}

export const WhatsNewContent = memo(function WhatsNewContent({
	config,
	plugin,
	fromVersion,
	toVersion,
	close: _close,
}: WhatsNewContentProps) {
	const app = useApp();
	const changelogRef = useRef<HTMLDivElement>(null);
	const [supportCollapsed, setSupportCollapsed] = useState(false);
	const [renderedCount, setRenderedCount] = useState(0);
	const renderingRef = useRef(false);
	useInjectedStyles(`${config.cssPrefix}-whats-new-styles`, buildWhatsNewStyles(config.cssPrefix));
	const cls = (suffix: string) => `${config.cssPrefix}-${suffix}`;

	const isFullChangelog = fromVersion === "0.0.0";
	const changelogSections = getChangelogSince(config.changelogContent, fromVersion, toVersion);
	const remaining = changelogSections.length - renderedCount;
	const toolsUrl = config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS;
	const youtubeUrl = config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE;

	const renderBatch = useCallback(
		async (el: HTMLElement, sections: VersionSection[]) => {
			if (renderingRef.current) return;
			renderingRef.current = true;

			const batch = computeNextBatch(sections, renderedCount);
			const batchMarkdown = resolveRelativeDocLinks(
				formatChangelogSections(batch),
				config.links.documentation
			);

			const batchContainer = document.createElement("div");
			el.appendChild(batchContainer);

			// eslint-disable-next-line obsidianmd/no-plugin-as-component -- short-lived modal, cleaned up on close
			await MarkdownRenderer.render(app, batchMarkdown, batchContainer, "/", plugin);
			makeExternalLinksClickable(batchContainer);

			setRenderedCount(renderedCount + batch.length);
			renderingRef.current = false;
		},
		[app, plugin, renderedCount, config.links.documentation]
	);

	useEffect(() => {
		if (!changelogRef.current || changelogSections.length === 0 || renderedCount > 0) return;
		void renderBatch(changelogRef.current, changelogSections);
	}, [changelogSections, renderBatch, renderedCount]);

	const handleLoadMore = useCallback(() => {
		if (!changelogRef.current) return;
		void renderBatch(changelogRef.current, changelogSections);
	}, [renderBatch, changelogSections]);

	const toggleSupport = useCallback(() => setSupportCollapsed((prev) => !prev), []);

	const headingText = config.supportSection
		? config.supportSection.heading
		: "Support the development of this plugin";

	return (
		<div data-testid={`${config.cssPrefix}-whats-new-modal`}>
			{!isFullChangelog && <p className={cls("whats-new-subtitle")}>Changes since v{fromVersion}</p>}

			<div className={cls("whats-new-support")}>
				{/* biome-ignore lint/a11y/useKeyboardHandler: collapsible header */}
				<div className={cls("whats-new-support-header")} onClick={toggleSupport} role="button" tabIndex={0}>
					<h3>{headingText}</h3>
					<span className={cls("whats-new-support-chevron")}>{supportCollapsed ? "▶" : "▼"}</span>
				</div>
				<div
					className={`${cls("whats-new-support-body")}${supportCollapsed ? ` ${cls("whats-new-support-collapsed")}` : ""}`}
				>
					{config.supportSection ? (
						<>
							<p>{config.supportSection.description}</p>
							{config.supportSection.cta && (
								<p>
									{"👉 "}
									<a href={config.supportSection.cta.href}>{config.supportSection.cta.text}</a>
								</p>
							)}
						</>
					) : (
						<>
							<p>
								If this plugin saves you time or improves how you work in Obsidian, consider supporting
								its development. Your support helps fund ongoing maintenance, new features, and
								long-term stability.
							</p>
							<p>
								{"👉 "}
								<a href={config.links.support}>Support my work</a>
							</p>
						</>
					)}
					<p>
						You can also explore my{" "}
						<a href={toolsUrl}>other Obsidian plugins and productivity tools</a>, or follow my{" "}
						<a href={youtubeUrl}>YouTube channel</a> for in-depth tutorials and workflow ideas.
					</p>
				</div>
			</div>

			{changelogSections.length === 0 ? (
				<p className={cls("whats-new-empty")}>No significant changes found in this update.</p>
			) : (
				<div className={cls("whats-new-content")}>
					<div ref={changelogRef} />
					{remaining > 0 && renderedCount > 0 && (
						<button type="button" className={cls("whats-new-load-more")} onClick={handleLoadMore}>
							Load more ({remaining} versions remaining)
						</button>
					)}
				</div>
			)}

			<div className={cls("whats-new-sticky-footer")}>
				<div className={cls("whats-new-buttons")}>
					{config.links.productPage && <FooterButton label="Product Page" href={config.links.productPage} />}
					<FooterButton label="GitHub" href={config.links.github} />
					<FooterButton label="Changelog" href={config.links.changelog} />
					<FooterButton label="Documentation" href={config.links.documentation} />
					<FooterButton label="Other Plugins" href={toolsUrl} />
					<FooterButton label="YouTube" href={youtubeUrl} />
				</div>
			</div>
		</div>
	);
});

export function showWhatsNewReactModal(
	app: App,
	plugin: Plugin,
	config: WhatsNewModalConfig,
	fromVersion: string,
	toVersion: string
): void {
	const isFullChangelog = fromVersion === "0.0.0";
	showReactModal({
		app,
		cls: `${config.cssPrefix}-whats-new-modal`,
		title: isFullChangelog ? `${config.pluginName} Changelog` : `${config.pluginName} updated to v${toVersion}`,
		render: (close) => (
			<WhatsNewContent config={config} plugin={plugin} fromVersion={fromVersion} toVersion={toVersion} close={close} />
		),
	});
}
