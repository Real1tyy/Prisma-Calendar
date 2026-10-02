import { fetchUnreleasedChangelog, type UnreleasedChangelog } from "@real1ty/obsidian-plugins";
import { sanitizeHTMLToDom, type App } from "obsidian";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { useScopedStyles } from "../hooks/styles/use-styles";
import { showReactModal } from "../show-react-modal";
import { makeExternalLinksClickable } from "../utils/external-links";
import { openExternal } from "../utils/open-external";
import type { WhatsNewModalConfig } from "./whats-new-modal";
import { buildWhatsNewStyles } from "./whats-new-modal.styles";

type UnreleasedConfig = Pick<WhatsNewModalConfig, "cssPrefix" | "pluginName" | "links">;

interface UnreleasedChangelogContentProps {
	config: UnreleasedConfig;
	/** Test seam; production reads the published changelog page. */
	loadUnreleased?: () => Promise<UnreleasedChangelog>;
}

type LoadState = { status: "loading" } | UnreleasedChangelog;

export const UnreleasedChangelogContent = memo(function UnreleasedChangelogContent({
	config,
	loadUnreleased,
}: UnreleasedChangelogContentProps) {
	const { cls, tid } = useScopedStyles("whats-new", buildWhatsNewStyles);
	const bodyRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState<LoadState>({ status: "loading" });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let live = true;
		setState({ status: "loading" });
		const load = loadUnreleased ?? (() => fetchUnreleasedChangelog(config.links.changelog, config.links.documentation));
		void load().then((result) => {
			if (live) setState(result);
		});
		return () => {
			live = false;
		};
	}, [loadUnreleased, config.links.changelog, config.links.documentation, attempt]);

	useEffect(() => {
		const el = bodyRef.current;
		if (!el || state.status !== "ok") return;
		// The page is fetched from the network, so it goes through Obsidian's
		// sanitizer before it touches the DOM.
		el.empty();
		el.append(sanitizeHTMLToDom(state.html));
		makeExternalLinksClickable(el);
	}, [state]);

	const retry = useCallback(() => setAttempt((n) => n + 1), []);
	const openChangelog = useCallback(() => openExternal(config.links.changelog), [config.links.changelog]);

	return (
		<div data-testid={tid("unreleased")}>
			<p className={cls("subtitle")}>
				Changes that have landed and will ship in the next release of {config.pluginName}.
			</p>
			<div className={cls("content")}>
				{state.status === "loading" && (
					<p className={cls("status")} data-testid={tid("unreleased-loading")}>
						Loading the latest changelog…
					</p>
				)}
				{state.status === "empty" && (
					<p className={cls("status")} data-testid={tid("unreleased-empty")}>
						Nothing is waiting for the next release right now — everything that has landed has already shipped.
					</p>
				)}
				{state.status === "error" && (
					<div className={cls("status")} data-testid={tid("unreleased-error")}>
						<p>{state.message}</p>
						<button type="button" onClick={retry} data-testid={tid("unreleased-retry")}>
							Try again
						</button>
					</div>
				)}
				<div ref={bodyRef} hidden={state.status !== "ok"} data-testid={tid("unreleased-body")} />
			</div>
			<div className={cls("sticky-footer")}>
				<div className={cls("buttons")}>
					<button type="button" onClick={openChangelog} data-testid={tid("unreleased-open-changelog")}>
						Open the full changelog
					</button>
				</div>
			</div>
		</div>
	);
});

/** Shows the live Unreleased section of the plugin's published changelog. */
export function showUnreleasedChangelogModal(app: App, config: UnreleasedConfig): void {
	showReactModal({
		app,
		cls: `${config.cssPrefix}whats-new-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		title: `${config.pluginName} — coming in the next release`,
		render: () => <UnreleasedChangelogContent config={config} />,
	});
}
