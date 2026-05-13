import { cls, tid } from "@real1ty-obsidian-plugins";

import type { EventSeriesBasesFooterActions } from "./event-series-bases-actions";
export function EventSeriesBasesFooter({ actions }: { actions: EventSeriesBasesFooterActions }) {
	const viewTypes = ["table", "list", "cards", "timeline", "heatmap"] as const;

	return (
		<div className={cls("event-series-bases-footer")}>
			<div className={cls("event-series-bases-footer-buttons")}>
				{viewTypes.map((vt) => (
					<button
						key={vt}
						className={cls("event-series-bases-btn")}
						data-testid={tid("event-series-bases", vt)}
						onClick={() => {
							if (vt === "timeline") actions.openTimeline();
							else if (vt === "heatmap") actions.openHeatmap();
							else actions.openBasesView(vt);
						}}
					>
						{vt.charAt(0).toUpperCase() + vt.slice(1)}
					</button>
				))}
			</div>
		</div>
	);
}
