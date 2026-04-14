import { SchemaSection, SettingHeading, SettingItem } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useState } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfig } from "../../types/settings";
import { SingleCalendarConfigSchema } from "../../types/settings";

interface NotificationsSettingsProps {
	settingsStore: CalendarSettingsStore;
}

const MAIN_FIELDS = ["enableNotifications", "notificationSound", "skipNewlyCreatedNotifications", "snoozeMinutes"];

const MAIN_OVERRIDES = {
	notificationSound: { label: "Play notification sound" },
	skipNewlyCreatedNotifications: { label: "Skip newly created events" },
	snoozeMinutes: { label: "Snooze duration (minutes)" },
};

export const NotificationsSettingsReact = memo(function NotificationsSettingsReact({
	settingsStore,
}: NotificationsSettingsProps) {
	return (
		<>
			<SchemaSection
				store={settingsStore}
				shape={SingleCalendarConfigSchema.shape}
				heading="Notifications"
				fields={MAIN_FIELDS}
				overrides={MAIN_OVERRIDES}
			/>
			<SettingHeading name="Default notification times" />
			<OptionalNumberField
				settingsStore={settingsStore}
				fieldKey="defaultMinutesBefore"
				name="Timed events (minutes before)"
				description="Default notification time for timed events. Leave empty for no default. 0 = notify when event starts, 15 = notify 15 minutes before"
				placeholder="e.g., 15 (leave empty for no default)"
			/>
			<OptionalNumberField
				settingsStore={settingsStore}
				fieldKey="defaultDaysBefore"
				name="All-day events (days before)"
				description="Default notification time for all-day events. Leave empty for no default. 0 = notify on the day of the event, 1 = notify 1 day before"
				placeholder="e.g., 1 (leave empty for no default)"
			/>
		</>
	);
});

interface OptionalNumberFieldProps {
	settingsStore: CalendarSettingsStore;
	fieldKey: keyof SingleCalendarConfig;
	name: string;
	description: string;
	placeholder: string;
}

const OptionalNumberField = memo(function OptionalNumberField({
	settingsStore,
	fieldKey,
	name,
	description,
	placeholder,
}: OptionalNumberFieldProps) {
	const initial = settingsStore.currentSettings[fieldKey] as number | undefined;
	const [draft, setDraft] = useState<string>(initial !== undefined ? String(initial) : "");

	useEffect(() => {
		const sub = settingsStore.settings$.subscribe((s) => {
			const v = s[fieldKey] as number | undefined;
			setDraft(v !== undefined ? String(v) : "");
		});
		return () => sub.unsubscribe();
	}, [settingsStore, fieldKey]);

	const commit = useCallback(
		(raw: string) => {
			const trimmed = raw.trim();
			if (trimmed === "") {
				void settingsStore.updateSettings((s) => ({ ...s, [fieldKey]: undefined }));
				return;
			}
			const num = Number(trimmed);
			if (!Number.isNaN(num) && Number.isInteger(num) && num >= 0) {
				void settingsStore.updateSettings((s) => ({ ...s, [fieldKey]: num }));
			}
		},
		[settingsStore, fieldKey]
	);

	return (
		<SettingItem name={name} description={description}>
			<TextInputWithCommit value={draft} placeholder={placeholder} onChange={setDraft} onCommit={commit} />
		</SettingItem>
	);
});

interface TextInputWithCommitProps {
	value: string;
	placeholder: string;
	onChange: (value: string) => void;
	onCommit: (value: string) => void;
}

const TextInputWithCommit = memo(function TextInputWithCommit({
	value,
	placeholder,
	onChange,
	onCommit,
}: TextInputWithCommitProps) {
	return (
		<input
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onBlur={(e) => onCommit(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					(e.target as HTMLInputElement).blur();
				}
			}}
		/>
	);
});
