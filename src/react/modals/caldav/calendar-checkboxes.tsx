import { memo, useCallback } from "react";

import { cls, tid } from "../../../constants";

interface CalendarInfo {
	url: string;
	displayName: string;
	description?: string | undefined;
}

interface CalendarCheckboxesProps {
	calendars: CalendarInfo[];
	selected: string[];
	onChange: (selected: string[]) => void;
}

export const CalendarCheckboxes = memo(function CalendarCheckboxes({
	calendars,
	selected,
	onChange,
}: CalendarCheckboxesProps) {
	const handleToggle = useCallback(
		(url: string, checked: boolean) => onChange(checked ? [...selected, url] : selected.filter((u) => u !== url)),
		[selected, onChange]
	);

	if (calendars.length === 0) {
		return (
			<div className={cls("caldav-calendar-selector")}>
				<p className={cls("settings-muted")}>Test connection to discover available calendars</p>
			</div>
		);
	}

	return (
		<div className={cls("caldav-calendar-selector")} data-testid={tid("caldav-calendar-selector")}>
			<h3>Select calendars to sync</h3>
			{calendars.map((cal) => (
				<div key={cal.url} className={cls("caldav-calendar-item")}>
					<input
						type="checkbox"
						checked={selected.includes(cal.url)}
						onChange={(e) => handleToggle(cal.url, e.target.checked)}
						data-testid={tid("caldav-calendar", cal.url)}
					/>
					<label>
						<strong>{cal.displayName}</strong>
						{cal.description && <span className={cls("settings-muted")}> — {cal.description}</span>}
					</label>
				</div>
			))}
		</div>
	);
});
