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
import { buildWhatsNewStyles } from "./whats-new-modal.styles";

const LINES_PER_PAGE = 15;

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
			const batchMarkdown = resolveRelativeDocLinks(formatChangelogSections(batch), config.links.documentation);

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

	const headingText = config.supportSection ? config.supportSection.heading : "Support the development of this plugin";

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
								If this plugin saves you time or improves how you work in Obsidian, consider supporting its development.
								Your support helps fund ongoing maintenance, new features, and long-term stability.
							</p>
							<p>
								{"👉 "}
								<a href={config.links.support}>Support my work</a>
							</p>
						</>
					)}
					<p>
						You can also explore my <a href={toolsUrl}>other Obsidian plugins and productivity tools</a>, or follow my{" "}
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
