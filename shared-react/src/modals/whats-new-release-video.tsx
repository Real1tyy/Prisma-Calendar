import { buildUtmUrl, type PluginSlug, type ReleaseVideo } from "@real1ty/obsidian-plugins";
import { memo } from "react";

import { useScoped } from "../contexts/theme-context";
import { OutboundLink } from "../primitives/atoms/outbound-link";

interface ReleaseVideoPanelProps {
	video: ReleaseVideo;
	version: string;
	slug: PluginSlug;
	collapsed: boolean;
	onToggle: () => void;
}

/**
 * YouTube's own player, embedded directly and never autoplayed. Chromium only
 * lets an embedded video play with sound after a click *inside* the player; a
 * thumbnail of ours that mounted the player with `autoplay=1` started it muted.
 * "Watch on YouTube" stays one click away should the embed refuse to play.
 */
export const ReleaseVideoPanel = memo(function ReleaseVideoPanel({
	video,
	version,
	slug,
	collapsed,
	onToggle,
}: ReleaseVideoPanelProps) {
	const { cls, tid } = useScoped("whats-new");
	const watchUrl = buildUtmUrl(video.videoUrl, slug, "plugin", "changelog", "release_video");

	return (
		<div className={cls("video")} data-testid={tid("video")}>
			<div className={cls("video-header")}>
				<button
					type="button"
					className={cls("video-toggle")}
					onClick={onToggle}
					aria-expanded={!collapsed}
					data-testid={tid("video-header")}
				>
					<span className={cls("support-chevron")}>{collapsed ? "▶" : "▼"}</span>
					<span className={cls("video-title")}>Release video</span>
				</button>
				<OutboundLink href={watchUrl} className={cls("video-link")} testId={tid("video-link")}>
					Watch on YouTube
				</OutboundLink>
			</div>
			{!collapsed && (
				<div className={cls("video-frame")} data-testid={tid("video-body")}>
					<iframe
						src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
						title={`Release video for v${version}`}
						allow="encrypted-media; picture-in-picture; fullscreen"
						allowFullScreen
						referrerPolicy="strict-origin-when-cross-origin"
						data-testid={tid("video-player")}
					/>
				</div>
			)}
		</div>
	);
});
