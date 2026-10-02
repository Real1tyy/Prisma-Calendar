import {
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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useApp } from "../contexts/app-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
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
	const [supportCollapsed, setSupportCollapsed] = useState(false);
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
	const currentSection = changelogSections[versionIndex];
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

	const toggleSupport = useCallback(() => setSupportCollapsed((prev) => !prev), []);
	const toggleVideo = useCallback(() => setVideoCollapsed((prev) => !prev), []);
	const currentVideo = loadedVideo !== null && loadedVideo.version === currentVersion ? loadedVideo.video : null;

	const headingText = config.supportSection ? config.supportSection.heading : "Support the development of this plugin";

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
					<h3>{headingText}</h3>
					<span className={cls("support-chevron")}>{supportCollapsed ? "▶" : "▼"}</span>
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
					<VersionNavigator sections={changelogSections} index={versionIndex} onSelect={setVersionIndex} />
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
