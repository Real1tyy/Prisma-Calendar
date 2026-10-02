import {
	buildUtmUrl,
	isYouTubePlaceholder,
	youTubeThumbnailUrls,
	type PluginSlug,
	type ReleaseVideo,
} from "@real1ty/obsidian-plugins";
import { memo, useState } from "react";

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
 * The thumbnail stands in for the player until it is clicked: nothing loads
 * from YouTube beyond one image until the reader asks for the video, and when
 * the embedded player refuses to play inside Obsidian the "Watch on YouTube"
 * link is still one click away.
 */
export const ReleaseVideoPanel = memo(function ReleaseVideoPanel({
	video,
	version,
	slug,
	collapsed,
	onToggle,
}: ReleaseVideoPanelProps) {
	const { cls, tid } = useScoped("whats-new");
	const [playing, setPlaying] = useState(false);
	const thumbnails = youTubeThumbnailUrls(video.youtubeId);
	const [thumbnail, setThumbnail] = useState(0);
	const stepDownThumbnail = () => setThumbnail((i) => Math.min(i + 1, thumbnails.length - 1));
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
					{playing ? (
						<iframe
							src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`}
							title={`Release video for v${version}`}
							allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
							referrerPolicy="strict-origin-when-cross-origin"
							data-testid={tid("video-player")}
						/>
					) : (
						<button
							type="button"
							className={cls("video-thumbnail")}
							onClick={() => setPlaying(true)}
							aria-label={`Play the release video for v${version}`}
							data-testid={tid("video-thumbnail")}
						>
							<img
								src={thumbnails[thumbnail]}
								alt=""
								onLoad={(e) => {
									if (isYouTubePlaceholder(e.currentTarget.naturalWidth)) stepDownThumbnail();
								}}
								onError={stepDownThumbnail}
								data-testid={tid("video-thumbnail-image")}
							/>
							<span className={cls("video-play")} aria-hidden="true">
								▶
							</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
});
