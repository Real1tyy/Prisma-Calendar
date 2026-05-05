import { cls } from "@real1ty-obsidian-plugins";
import { useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo, useMemo } from "react";

import type { PrismaCalendarSettingsStore } from "../../types";
import { describeConflict, findConflictForCalendar } from "../../utils/calendar-conflicts";

interface NormalizationConflictBannerProps {
	calendarId: string;
	mainSettingsStore: PrismaCalendarSettingsStore;
}

export const NormalizationConflictBanner = memo(function NormalizationConflictBanner({
	calendarId,
	mainSettingsStore,
}: NormalizationConflictBannerProps) {
	const [mainSettings] = useSettingsStore(mainSettingsStore);
	const conflict = useMemo(
		() => findConflictForCalendar(calendarId, mainSettings.calendars),
		[calendarId, mainSettings.calendars]
	);

	if (!conflict) return null;

	return (
		<div
			role="alert"
			className={cls("normalization-conflict-banner")}
			data-testid={`prisma-normalization-conflict-${calendarId}`}
		>
			<span aria-hidden="true" className={cls("normalization-conflict-icon")}>
				⚠
			</span>
			<div className={cls("normalization-conflict-content")}>
				<div className={cls("normalization-conflict-title")}>Sort date conflict</div>
				<div className={cls("normalization-conflict-body")}>{describeConflict(conflict)}</div>
			</div>
		</div>
	);
});
