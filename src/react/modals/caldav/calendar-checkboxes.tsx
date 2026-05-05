import { memo, useCallback } from "react";

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
		(url: string, checked: boolean) => {
			onChange(checked ? [...selected, url] : selected.filter((u) => u !== url));
		},
		[selected, onChange]
	);

	if (calendars.length === 0) {
		return (
			<div className="prisma-caldav-calendar-selector">
				<p className="prisma-settings-muted">Test connection to discover available calendars</p>
			</div>
		);
	}

	return (
		<div className="prisma-caldav-calendar-selector" data-testid="prisma-caldav-calendar-selector">
			<h3>Select calendars to sync</h3>
			{calendars.map((cal) => (
				<div key={cal.url} className="prisma-caldav-calendar-item">
					<input
						type="checkbox"
						checked={selected.includes(cal.url)}
						onChange={(e) => handleToggle(cal.url, e.target.checked)}
						data-testid={`prisma-caldav-calendar-${cal.url}`}
					/>
					<label>
						<strong>{cal.displayName}</strong>
						{cal.description && <span className="prisma-settings-muted"> — {cal.description}</span>}
					</label>
				</div>
			))}
		</div>
	);
});
