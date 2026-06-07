import {
	formatChangelogSections,
	getChangelogSince,
	resolveRelativeDocLinks,
	type VersionSection,
} from "@real1ty-obsidian-plugins";
import { Component, MarkdownRenderer, type App, type Plugin } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "../contexts/app-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { showReactModal } from "../show-react-modal";
import { openExternal } from "../utils/open-external";
import { buildWhatsNewStyles } from "./whats-new-modal.styles";

const LINES_PER_PAGE = 15;

export const DEFAULT_WHATS_NEW_LINKS = {
	TOOLS: "https://matejvavroproductivity.com/tools/",
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

export interface WhatsNewModalConfig {
	/** Trailing-dash convention, e.g. `"prisma-"`. Drives the modal class, theme provider, and stylesheet selectors. */
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
	fromVersion: string;
	toVersion: string;
	close: () => void;
}

function openExternalFromElement(source: HTMLElement, href: string): void {
	const ownerWindow = source.ownerDocument.defaultView ?? window;
	ownerWindow.open(href, "_blank");
}

function makeExternalLinksClickable(container: HTMLElement): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]");
	for (const link of Array.from(links)) {
		const href = link.getAttribute("href");
		if (!href || !href.startsWith("http")) continue;

		link.addEventListener("click", (e: MouseEvent) => {
			e.preventDefault();
			openExternalFromElement(link, href);
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
	const handleClick = useCallback(() => openExternal(href), [href]);
	return (
		<button type="button" onClick={handleClick}>
			{label}
		</button>
	);
}

export const WhatsNewContent = memo(function WhatsNewContent({
	config,
	fromVersion,
	toVersion,
	close: _close,
}: WhatsNewContentProps) {
	const app = useApp();
	const changelogRef = useRef<HTMLDivElement>(null);
	const [supportCollapsed, setSupportCollapsed] = useState(false);
	const [renderedCount, setRenderedCount] = useState(0);
	const renderingRef = useRef(false);
	const { cls, tid } = useScopedStyles("whats-new", buildWhatsNewStyles);

	// Scoped Obsidian Component owns the lifecycle of MarkdownRenderer outputs
	// (live preview workers, embedded views, link-event listeners). Tied to the
	// modal lifetime so embeds tear down on close — passing the long-lived
	// plugin instance here would leak.
	const renderComponentRef = useRef<Component | null>(null);
	useEffect(() => {
		const component = new Component();
		component.load();
		renderComponentRef.current = component;
		return () => {
			component.unload();
			renderComponentRef.current = null;
		};
	}, []);

	const isFullChangelog = fromVersion === "0.0.0";
	const changelogSections = useMemo(
		() => getChangelogSince(config.changelogContent, fromVersion, toVersion),
		[config.changelogContent, fromVersion, toVersion]
	);
	const remaining = changelogSections.length - renderedCount;
	const toolsUrl = config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS;
	const youtubeUrl = config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE;

	const renderBatch = useCallback(
		async (el: HTMLElement, sections: VersionSection[]) => {
			if (renderingRef.current) return;

			const component = renderComponentRef.current;
			if (!component) return;

			renderingRef.current = true;
			try {
				const batch = computeNextBatch(sections, renderedCount);
				if (batch.length === 0) return;

				const batchMarkdown = resolveRelativeDocLinks(formatChangelogSections(batch), config.links.documentation);

				const batchContainer = el.ownerDocument.createElement("div");
				el.appendChild(batchContainer);

				await MarkdownRenderer.render(app, batchMarkdown, batchContainer, "/", component);
				makeExternalLinksClickable(batchContainer);

				setRenderedCount((current) => current + batch.length);
			} finally {
				renderingRef.current = false;
			}
		},
		[app, renderedCount, config.links.documentation]
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
		<div data-testid={tid("modal")}>
			{!isFullChangelog && <p className={cls("subtitle")}>Changes since v{fromVersion}</p>}

			<div className={cls("support")}>
				{/* biome-ignore lint/a11y/useKeyboardHandler: collapsible header */}
				<div className={cls("support-header")} onClick={toggleSupport} role="button" tabIndex={0}>
					<h3>{headingText}</h3>
					<span className={cls("support-chevron")}>{supportCollapsed ? "▶" : "▼"}</span>
				</div>
				<div className={`${cls("support-body")}${supportCollapsed ? ` ${cls("support-collapsed")}` : ""}`}>
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
				<p className={cls("empty")}>No significant changes found in this update.</p>
			) : (
				<div className={cls("content")}>
					<div ref={changelogRef} />
					{remaining > 0 && renderedCount > 0 && (
						<button type="button" className={cls("load-more")} onClick={handleLoadMore}>
							Load more ({remaining} versions remaining)
						</button>
					)}
				</div>
			)}

			<div className={cls("sticky-footer")}>
				<div className={cls("buttons")}>
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
	_plugin: Plugin,
	config: WhatsNewModalConfig,
	fromVersion: string,
	toVersion: string
): void {
	const isFullChangelog = fromVersion === "0.0.0";
	showReactModal({
		app,
		cls: `${config.cssPrefix}whats-new-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: isFullChangelog ? `${config.pluginName} Changelog` : `${config.pluginName} updated to v${toVersion}`,
		render: (close) => (
			<WhatsNewContent config={config} fromVersion={fromVersion} toVersion={toVersion} close={close} />
		),
	});
}
