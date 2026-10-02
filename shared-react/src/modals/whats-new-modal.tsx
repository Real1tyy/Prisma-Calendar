import {
	changelogSectionUrl,
	createReleaseVideoLookup,
	formatChangelogBody,
	FULL_CHANGELOG_FROM_VERSION,
	getChangelogSince,
	initialVersionIndex,
	resolveRelativeDocLinks,
	type PluginSlug,
	type ReleaseVideo,
	type ReleaseVideoLookup,
} from "@real1ty/obsidian-plugins";
import { Component, MarkdownRenderer, type App, type Plugin } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { useApp } from "../contexts/app-context";
import { useOwnerDocument } from "../contexts/theme-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { OutboundLink } from "../primitives/atoms/outbound-link";
import { showReactModal } from "../show-react-modal";
import { makeExternalLinksClickable } from "../utils/external-links";
import { openExternal } from "../utils/open-external";
import { buildWhatsNewStyles } from "./whats-new-modal.styles";
import { ReleaseVideoPanel } from "./whats-new-release-video";
import { VersionNavigator } from "./whats-new-version-navigator";

export const DEFAULT_WHATS_NEW_LINKS = {
	TOOLS: "https://matejvavroproductivity.com/tools/",
	YOUTUBE: "https://www.youtube.com/@MatejVavroProductivity?sub_confirmation=1",
} as const;

export interface WhatsNewModalConfig {
	/** Trailing-dash convention, e.g. `"prisma-"`. Drives the modal class, theme provider, and stylesheet selectors. */
	cssPrefix: string;
	pluginName: string;
	/** Keys the per-version release-video lookup and the video link's UTM. */
	slug: PluginSlug;
	changelogContent: string;
	links: {
		support: string;
		/** The published changelog page — also where "View unreleased" reads the live Unreleased section. */
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
	/** Test seam; production builds one per modal from `config.slug`. */
	releaseVideoLookup?: ReleaseVideoLookup;
}

function stopPropagation(e: MouseEvent): void {
	e.stopPropagation();
}

/**
 * Typing in the version search (or any field) owns the arrow keys. Duck-typed
 * because `instanceof HTMLElement` fails for elements in a pop-out window.
 */
function isTextEntry(target: EventTarget | null): boolean {
	const el = target as Partial<HTMLElement> | null;
	if (el === null || typeof el.tagName !== "string") return false;
	return el.isContentEditable === true || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
}

/**
 * Native `scroll-behavior: smooth` takes roughly 450 ms and exposes no speed
 * control; this eases over a third of that so ↑ / ↓ feel instant but still
 * show where they went. Uses the element's own window so it runs in pop-outs.
 */
const SCROLL_DURATION_MS = 150;

function animateScrollTo(el: HTMLElement, target: number): void {
	const view = el.ownerDocument.defaultView;
	const start = el.scrollTop;
	const distance = target - start;
	if (view === null || typeof view.requestAnimationFrame !== "function" || distance === 0) {
		el.scrollTop = target;
		return;
	}
	const startedAt = view.performance.now();
	// Read the clock here rather than trusting the frame timestamp, whose origin
	// differs between environments.
	const step = () => {
		const elapsed = view.performance.now() - startedAt;
		const progress = Math.min(Math.max(elapsed / SCROLL_DURATION_MS, 0), 1);
		el.scrollTop = start + distance * (1 - (1 - progress) ** 3);
		if (progress < 1) view.requestAnimationFrame(step);
	};
	view.requestAnimationFrame(step);
}

interface LoadedVideo {
	version: string;
	video: ReleaseVideo | null;
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
	releaseVideoLookup,
}: WhatsNewContentProps) {
	const app = useApp();
	const contentRef = useRef<HTMLDivElement>(null);
	const changelogRef = useRef<HTMLDivElement>(null);
	// Collapsed by default so the changelog, not the pitch, fills the modal;
	// the heading itself stays a link to the call to action.
	const [supportCollapsed, setSupportCollapsed] = useState(true);
	const ownerDocument = useOwnerDocument();
	// Lives for the modal, not the version: collapsing the video once keeps it
	// out of the way while the reader steps through releases.
	const [videoCollapsed, setVideoCollapsed] = useState(false);
	const [loadedVideo, setLoadedVideo] = useState<LoadedVideo | null>(null);
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

	const isFullChangelog = fromVersion === FULL_CHANGELOG_FROM_VERSION;
	const changelogSections = useMemo(
		() => getChangelogSince(config.changelogContent, fromVersion, toVersion),
		[config.changelogContent, fromVersion, toVersion]
	);
	const [versionIndex, setVersionIndex] = useState(() => initialVersionIndex(changelogSections.length, fromVersion));
	// Empty when the update range holds no versions.
	const currentSection = changelogSections.at(versionIndex);
	const currentVersion = currentSection?.version;
	const toolsUrl = config.links.tools ?? DEFAULT_WHATS_NEW_LINKS.TOOLS;
	const youtubeUrl = config.links.youtube ?? DEFAULT_WHATS_NEW_LINKS.YOUTUBE;

	const lookupVideo = useMemo(
		() => releaseVideoLookup ?? createReleaseVideoLookup(config.slug),
		[releaseVideoLookup, config.slug]
	);

	useEffect(() => {
		if (currentVersion === undefined) return;
		let live = true;
		void lookupVideo(currentVersion).then((video) => {
			if (live) setLoadedVideo({ version: currentVersion, video });
		});
		return () => {
			live = false;
		};
	}, [lookupVideo, currentVersion]);

	useEffect(() => {
		const el = changelogRef.current;
		const parent = renderComponentRef.current;
		if (!el || !parent || currentSection === undefined) return;

		// One child Component per shown version, so stepping away tears down
		// whatever the previous version's render registered.
		const child = new Component();
		parent.addChild(child);
		el.empty();
		const target = el.createDiv();
		const markdown = resolveRelativeDocLinks(formatChangelogBody(currentSection), config.links.documentation);
		void MarkdownRenderer.render(app, markdown, target, "/", child).then(() => makeExternalLinksClickable(target));
		if (contentRef.current) contentRef.current.scrollTop = 0;
		return () => {
			parent.removeChild(child);
		};
	}, [app, currentSection, config.links.documentation]);

	const sectionCount = changelogSections.length;
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || isTextEntry(e.target)) return;
			const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
			if (step === 0 || sectionCount === 0) return;
			e.preventDefault();
			setVersionIndex((i) => Math.min(Math.max(i + step, 0), sectionCount - 1));
		};
		ownerDocument.addEventListener("keydown", onKeyDown);
		return () => ownerDocument.removeEventListener("keydown", onKeyDown);
	}, [ownerDocument, sectionCount]);

	const scrollToTop = useCallback(() => {
		if (contentRef.current) animateScrollTo(contentRef.current, 0);
	}, []);
	const scrollToBottom = useCallback(() => {
		const el = contentRef.current;
		if (el) animateScrollTo(el, el.scrollHeight - el.clientHeight);
	}, []);

	const toggleSupport = useCallback(() => setSupportCollapsed((prev) => !prev), []);
	const toggleVideo = useCallback(() => setVideoCollapsed((prev) => !prev), []);
	const currentVideo = loadedVideo !== null && loadedVideo.version === currentVersion ? loadedVideo.video : null;

	const headingText = config.supportSection ? config.supportSection.heading : "Support the development of this plugin";
	const headingHref = config.supportSection?.cta?.href ?? config.links.support;

	return (
		<div data-testid={tid("modal")}>
			{!isFullChangelog && <p className={cls("subtitle")}>Changes since v{fromVersion}</p>}

			<div className={cls("support")}>
				{/* biome-ignore lint/a11y/useKeyboardHandler: collapsible header */}
				<div
					className={cls("support-header")}
					data-testid={tid("support-header")}
					onClick={toggleSupport}
					role="button"
					tabIndex={0}
				>
					<h3>
						{/* The heading doubles as the CTA so a collapsed banner still leads somewhere. */}
						<OutboundLink
							href={headingHref}
							className={cls("support-link")}
							testId={tid("support-link")}
							onClick={stopPropagation}
						>
							{headingText}
						</OutboundLink>
					</h3>
					<span className={cls("support-chevron")} data-testid={tid("support-chevron")}>
						{supportCollapsed ? "▶" : "▼"}
					</span>
				</div>
				<div
					className={`${cls("support-body")}${supportCollapsed ? ` ${cls("support-collapsed")}` : ""}`}
					data-testid={tid("support-body")}
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
				<p className={cls("empty")}>No significant changes found in this update.</p>
			) : (
				<>
					<div className={cls("version-header")}>
						<VersionNavigator sections={changelogSections} index={versionIndex} onSelect={setVersionIndex} />
						<div className={cls("scroll-buttons")}>
							<button
								type="button"
								onClick={scrollToTop}
								aria-label="Scroll to top"
								title="Scroll to top"
								data-testid={tid("scroll-top")}
							>
								↑
							</button>
							<button
								type="button"
								onClick={scrollToBottom}
								aria-label="Scroll to bottom"
								title="Scroll to bottom"
								data-testid={tid("scroll-bottom")}
							>
								↓
							</button>
						</div>
					</div>
					<div className={cls("content")} ref={contentRef} data-testid={tid("content")}>
						{currentVideo !== null && currentVersion !== undefined && (
							<ReleaseVideoPanel
								key={currentVersion}
								video={currentVideo}
								version={currentVersion}
								slug={config.slug}
								collapsed={videoCollapsed}
								onToggle={toggleVideo}
							/>
						)}
						<div ref={changelogRef} data-testid={tid("version-body")} />
					</div>
				</>
			)}

			<div className={cls("sticky-footer")}>
				<div className={cls("buttons")}>
					{config.links.productPage && <FooterButton label="Product Page" href={config.links.productPage} />}
					<FooterButton label="GitHub" href={config.links.github} />
					<FooterButton
						label="Changelog"
						href={
							currentVersion !== undefined
								? changelogSectionUrl(config.links.changelog, currentVersion)
								: config.links.changelog
						}
					/>
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
	const isFullChangelog = fromVersion === FULL_CHANGELOG_FROM_VERSION;
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
