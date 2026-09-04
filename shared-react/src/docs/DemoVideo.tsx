import type { CSSProperties, ReactElement } from "react";

import { resolveDemoSources, type DemoVideoProps } from "./demo-sources";

// Shared, framework-agnostic player for a recorded showrunner demo
// ([[spec-showrunner-docs-publishing]] R1). Imports nothing but React + the
// pure resolver, so the exact file is copied verbatim into each Docusaurus
// docs-site's `src/components/` (the sites are standalone pnpm projects mirrored
// to public repos — they cannot depend on this workspace). Poster-first and
// `preload="metadata"` keep it lazy: only the poster + container metadata load
// until the viewer presses play.

export type { DemoVideoProps } from "./demo-sources";

const VIDEO_STYLE: CSSProperties = {
	width: "100%",
	maxWidth: "900px",
	borderRadius: "8px",
	display: "block",
	margin: "0 auto",
};

const FIGURE_STYLE: CSSProperties = {
	margin: "0 0 2em",
	textAlign: "center",
};

export function DemoVideo(props: DemoVideoProps): ReactElement {
	const { mp4, webm, poster } = resolveDemoSources(props);

	const video = (
		<video
			controls
			muted
			playsInline
			preload="metadata"
			poster={poster}
			data-testid="demo-video"
			data-demo-id={props.id}
			style={VIDEO_STYLE}
		>
			<source src={mp4} type="video/mp4" />
			{webm ? <source src={webm} type="video/webm" /> : null}
			Your browser does not support the video tag.
		</video>
	);

	if (!props.caption) {
		return video;
	}

	return (
		<figure style={FIGURE_STYLE}>
			{video}
			<figcaption>{props.caption}</figcaption>
		</figure>
	);
}

export default DemoVideo;
