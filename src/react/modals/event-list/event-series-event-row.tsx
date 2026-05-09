import type { CSSProperties } from "react";
import { memo, useEffect, useRef } from "react";

import { applyMultiColorIndicators } from "../../../components/calendar-event-renderer";
import type { SingleCalendarConfig } from "../../../types/settings";
import type { EventRowItem } from "./event-series-types";

type MultiColorSettings = Pick<SingleCalendarConfig, "colorMode" | "showEventColorDots">;

export const EventSeriesEventRow = memo(function EventSeriesEventRow({
	item,
	isPast,
	settings,
	onClick,
}: {
	item: EventRowItem;
	isPast: boolean;
	settings: MultiColorSettings;
	onClick: () => void;
}) {
	const rowRef = useRef<HTMLDivElement>(null);

	const classNames = [
		"prisma-recurring-event-row",
		isPast && "prisma-recurring-event-past",
		item.color && "prisma-recurring-event-colorized",
	]
		.filter(Boolean)
		.join(" ");

	const style: CSSProperties | undefined = item.color ? ({ "--event-color": item.color } as CSSProperties) : undefined;

	useEffect(() => {
		const el = rowRef.current;
		if (!el) return;
		if (item.allColors && item.allColors.length >= 2) {
			applyMultiColorIndicators(el, item.allColors, settings, { maxDots: 4, colorMixRatio: 0.15 });
		}
		return () => {
			el.style.removeProperty("background-image");
			el.style.removeProperty("border-color");
			el.querySelector(".prisma-inline-color-dots")?.remove();
		};
	}, [item.allColors, settings]);

	const dateIso = item.date.toFormat("yyyy-MM-dd");

	return (
		<div
			ref={rowRef}
			className={classNames}
			style={style}
			onClick={onClick}
			data-event-file-path={item.filePath}
			data-event-date={dateIso}
			data-event-skipped={item.skipped ? "true" : "false"}
		>
			<div className="prisma-recurring-event-date">{`${dateIso} (${item.date.toFormat("EEE")})`}</div>
			<div className={`prisma-recurring-event-title${item.skipped ? " prisma-recurring-event-skipped" : ""}`}>
				{item.title}
			</div>
		</div>
	);
});
