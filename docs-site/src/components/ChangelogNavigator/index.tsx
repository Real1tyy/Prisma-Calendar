// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is synced
// into every */docs-site/src by `mise run sync-docs-site-theme`. Edit it there.

import { useHistory, useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import { fetchReleaseVideos, type ReleaseVideo } from "./release-video";
import { pluginSlugFromSiteUrl } from "./site";
import {
	applySectionFilter,
	CHANGELOG_VERSION_PARAM,
	readChangelogLayout,
	selectedSectionFromSearch,
	UNRELEASED_KEY,
	type ChangelogLayout,
} from "./changelog-sections";
import styles from "./styles.module.css";

interface Option {
	/** `null` = all releases. */
	key: string | null;
	label: string;
}

const ALL_RELEASES: Option = { key: null, label: "All releases" };

function optionLabel(key: string): string {
	return key === UNRELEASED_KEY ? "Unreleased" : `v${key}`;
}

function matches(option: Option, query: string): boolean {
	const needle = query.trim().replace(/^v/i, "").toLowerCase();
	return needle === "" || option.label.toLowerCase().includes(needle);
}

/** Hide the table-of-contents entries of the sections the filter hid. */
function syncTableOfContents(sectionIds: ReadonlySet<string>, hiddenIds: ReadonlySet<string>): void {
	for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(".table-of-contents a[href^='#']"))) {
		const id = decodeURIComponent(anchor.hash.slice(1));
		const item = anchor.closest("li");
		if (item !== null && sectionIds.has(id)) item.hidden = hiddenIds.has(id);
	}
}

function withDocsUtm(videoUrl: string, slug: string): string {
	const url = new URL(videoUrl);
	url.searchParams.set("utm_campaign", slug.replace(/-/g, "_"));
	url.searchParams.set("utm_source", "docs");
	url.searchParams.set("utm_medium", "changelog");
	url.searchParams.set("utm_content", "release_video");
	return url.toString();
}

function ReleaseVideoPanel({
	video,
	version,
	slug,
	collapsed,
	onToggle,
}: {
	video: ReleaseVideo;
	version: string;
	slug: string;
	collapsed: boolean;
	onToggle: () => void;
}) {
	const [playing, setPlaying] = useState(false);
	return (
		<div className={styles.video}>
			<div className={styles.videoHeader}>
				<button type="button" className={styles.videoToggle} onClick={onToggle} aria-expanded={!collapsed}>
					<span aria-hidden="true">{collapsed ? "▶" : "▼"}</span> Release video
				</button>
				<a href={withDocsUtm(video.videoUrl, slug)} target="_blank" rel="noopener noreferrer">
					Watch on YouTube
				</a>
			</div>
			{!collapsed && (
				<div className={styles.videoFrame}>
					{playing ? (
						<iframe
							src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`}
							title={`Release video for v${version}`}
							allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
							allowFullScreen
							referrerPolicy="strict-origin-when-cross-origin"
						/>
					) : (
						<button
							type="button"
							className={styles.videoThumbnail}
							onClick={() => setPlaying(true)}
							aria-label={`Play the release video for v${version}`}
						>
							<img src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" />
							<span className={styles.videoPlay} aria-hidden="true">
								▶
							</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Narrows the changelog page to one release through `?version=` (a version,
 * `unreleased`, or absent for everything), with the same newer ‹ / older ›
 * arrows and searchable picker as the in-app changelog.
 */
export default function ChangelogNavigator({ contentRef }: { contentRef: RefObject<HTMLDivElement | null> }) {
	const { siteConfig } = useDocusaurusContext();
	const location = useLocation();
	const history = useHistory();
	const [layout, setLayout] = useState<ChangelogLayout | null>(null);
	const [query, setQuery] = useState<string | null>(null);
	const [highlight, setHighlight] = useState(0);
	// Lives for the page visit: collapse the video once and it stays out of the way.
	const [videoCollapsed, setVideoCollapsed] = useState(false);
	// Every release's video, fetched once, the first time a single release is shown.
	const [videos, setVideos] = useState<Map<string, ReleaseVideo> | null>(null);
	const videosRequested = useRef(false);
	const slug = pluginSlugFromSiteUrl(siteConfig.url);

	useEffect(() => {
		const markdown = contentRef.current?.querySelector<HTMLElement>(".theme-doc-markdown");
		if (markdown) setLayout(readChangelogLayout(markdown));
	}, [contentRef]);

	const options = useMemo<Option[]>(
		() => [ALL_RELEASES, ...(layout?.sections ?? []).map((s) => ({ key: s.key, label: optionLabel(s.key) }))],
		[layout]
	);
	const selected = selectedSectionFromSearch(
		location.search,
		options.flatMap((o) => (o.key === null ? [] : [o.key]))
	);
	const index = Math.max(
		options.findIndex((o) => o.key === selected),
		0
	);
	const current = options[index] ?? ALL_RELEASES;

	useEffect(() => {
		if (layout === null) return;
		const hidden = applySectionFilter(layout, selected);
		syncTableOfContents(new Set(layout.sections.map((s) => s.heading.id).filter(Boolean)), hidden);
	}, [layout, selected]);

	const isRelease = selected !== null && selected !== UNRELEASED_KEY;
	useEffect(() => {
		if (!isRelease || slug === null || videosRequested.current) return;
		videosRequested.current = true;
		void fetchReleaseVideos(slug).then(setVideos);
	}, [isRelease, slug]);

	const select = useCallback(
		(key: string | null) => {
			const params = new URLSearchParams(location.search);
			if (key === null) params.delete(CHANGELOG_VERSION_PARAM);
			else params.set(CHANGELOG_VERSION_PARAM, key);
			const search = params.toString();
			history.push({ pathname: location.pathname, search: search ? `?${search}` : "" });
			contentRef.current?.scrollIntoView({ block: "start" });
		},
		[history, location.pathname, location.search, contentRef]
	);

	const filtered = query === null ? [] : options.filter((o) => matches(o, query));
	const choose = (option: Option | undefined) => {
		if (option !== undefined) select(option.key);
		setQuery(null);
		setHighlight(0);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlight((h) => Math.max(h - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			choose(filtered[highlight]);
			e.currentTarget.blur();
		}
	};

	if (layout === null || layout.sections.length === 0) return null;

	const shownVideo =
		selected !== null && selected !== UNRELEASED_KEY && videos !== null ? (videos.get(selected) ?? null) : null;

	return (
		<div className={styles.navigator} data-testid="changelog-navigator">
			<div className={styles.bar}>
				<button
					type="button"
					className={styles.arrow}
					onClick={() => select(options[index - 1]?.key ?? null)}
					disabled={index === 0}
					aria-label="Newer"
					title="Newer"
				>
					‹
				</button>
				<div className={styles.picker}>
					<input
						className={styles.input}
						value={query ?? current.label}
						placeholder="Search versions"
						aria-label="Version"
						role="combobox"
						aria-expanded={query !== null}
						onFocus={() => setQuery("")}
						onBlur={() => setQuery(null)}
						onChange={(e) => {
							setQuery(e.target.value);
							setHighlight(0);
						}}
						onKeyDown={handleKeyDown}
					/>
					{query !== null && (
						<ul className={styles.list} role="listbox">
							{filtered.length === 0 ? (
								<li className={styles.empty}>No matching version</li>
							) : (
								filtered.map((option, i) => (
									<li
										key={option.key ?? "all"}
										role="option"
										aria-selected={i === highlight}
										className={i === highlight ? `${styles.option} ${styles.active}` : styles.option}
										// mousedown, not click: the input's blur closes the list before a click lands.
										onMouseDown={(e) => {
											e.preventDefault();
											choose(option);
										}}
									>
										{option.label}
									</li>
								))
							)}
						</ul>
					)}
				</div>
				<button
					type="button"
					className={styles.arrow}
					onClick={() => select(options[index + 1]?.key ?? null)}
					disabled={index === options.length - 1}
					aria-label="Older"
					title="Older"
				>
					›
				</button>
			</div>
			{shownVideo !== null && selected !== null && slug !== null && (
				<ReleaseVideoPanel
					key={selected}
					video={shownVideo}
					version={selected}
					slug={slug}
					collapsed={videoCollapsed}
					onToggle={() => setVideoCollapsed((c) => !c)}
				/>
			)}
		</div>
	);
}
