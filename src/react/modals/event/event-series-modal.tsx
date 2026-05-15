import { openReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";

export type SeriesEditScope = "this" | "following" | "all";

export function openEventSeriesModal(app: App, title: string): Promise<SeriesEditScope | null> {
	return openReactModal<SeriesEditScope>({
		app,
		cls: "prisma-series-scope-modal",
		title: `Edit recurring event: ${title}`,
		render: (submit, cancel) => (
			<div className="prisma-series-scope-content">
				<p>This is a recurring event. Which instances do you want to modify?</p>
				<div className="prisma-modal-button-container prisma-series-scope-buttons">
					<button type="button" onClick={() => submit("this")} data-testid="prisma-series-scope-this">
						This event
					</button>
					<button type="button" onClick={() => submit("following")} data-testid="prisma-series-scope-following">
						This and following events
					</button>
					<button type="button" onClick={() => submit("all")} data-testid="prisma-series-scope-all">
						All events
					</button>
					<button type="button" className="mod-cancel" onClick={cancel} data-testid="prisma-series-scope-cancel">
						Cancel
					</button>
				</div>
			</div>
		),
	});
}
