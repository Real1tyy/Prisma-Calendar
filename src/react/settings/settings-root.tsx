import { cls } from "@real1ty-obsidian-plugins";
import {
	Dropdown,
	openRenameModal,
	SettingHeading,
	SettingItem,
	useApp,
	useSettingsStore,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useMemo, useState } from "react";

import { FREE_MAX_CALENDARS } from "../../core/license";
import { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import { openConfigureCalendarModal } from "../../onboarding/configure-calendar";
import {
	createDefaultCalendarConfig,
	duplicateCalendarConfig,
	generateUniqueCalendarId,
} from "../../utils/calendar-settings";
import { SingleCalendarSettingsReact } from "./single-calendar-settings-react";

interface SettingsRootProps {
	plugin: CustomCalendarPlugin;
}

export const SettingsRoot = memo(function SettingsRoot({ plugin }: SettingsRootProps) {
	const app = useApp();
	const [mainSettings, updateMainSettings] = useSettingsStore(plugin.settingsStore);
	const [selectedCalendarId, setSelectedCalendarId] = useState(mainSettings.calendars[0]?.id ?? "default");

	const calendars = mainSettings.calendars;
	const maxCalendars = plugin.isProEnabled ? Infinity : FREE_MAX_CALENDARS;
	const isAtMax = calendars.length >= maxCalendars;
	const selectedCalendar = useMemo(
		() => calendars.find((c) => c.id === selectedCalendarId) ?? null,
		[calendars, selectedCalendarId]
	);

	const calendarStore = useMemo(() => {
		try {
			return new CalendarSettingsStore(plugin.settingsStore, selectedCalendarId);
		} catch {
			return null;
		}
	}, [plugin.settingsStore, selectedCalendarId]);

	const calendarOptions = useMemo(
		() => Object.fromEntries(calendars.map((cal) => [cal.id, `${cal.name}${cal.enabled ? "" : " (disabled)"}`])),
		[calendars]
	);

	const countText =
		maxCalendars === Infinity ? `${calendars.length} calendars` : `${calendars.length}/${maxCalendars} calendars`;
	const maxTitle = isAtMax
		? `Free plan allows up to ${maxCalendars} calendars. Upgrade to Pro for unlimited.`
		: undefined;

	const updateSelectedCalendar = useCallback(
		async (patch: Partial<(typeof calendars)[number]>) => {
			await updateMainSettings((s) => ({
				...s,
				calendars: s.calendars.map((cal) => (cal.id === selectedCalendarId ? { ...cal, ...patch } : cal)),
			}));
			await plugin.refreshCalendarBundles();
		},
		[selectedCalendarId, updateMainSettings, plugin]
	);

	const handleCreate = useCallback(async () => {
		if (isAtMax) return;
		const newId = generateUniqueCalendarId(mainSettings);
		const newName = `Calendar ${calendars.length + 1}`;
		const newCalendar = createDefaultCalendarConfig(newId, newName);
		await updateMainSettings((s) => ({ ...s, calendars: [...s.calendars, newCalendar] }));
		setSelectedCalendarId(newId);
		await plugin.refreshCalendarBundles();
	}, [isAtMax, mainSettings, calendars.length, updateMainSettings, plugin]);

	const handleClone = useCallback(async () => {
		if (isAtMax || !selectedCalendar) return;
		const newId = generateUniqueCalendarId(mainSettings);
		const cloned = duplicateCalendarConfig(selectedCalendar, newId, `${selectedCalendar.name} (Copy)`);
		await updateMainSettings((s) => ({ ...s, calendars: [...s.calendars, cloned] }));
		setSelectedCalendarId(newId);
		await plugin.refreshCalendarBundles();
	}, [isAtMax, selectedCalendar, mainSettings, updateMainSettings, plugin]);

	const handleDelete = useCallback(async () => {
		if (calendars.length <= 1) return;
		const currentIndex = calendars.findIndex((c) => c.id === selectedCalendarId);
		if (currentIndex === -1) return;
		const updated = calendars.filter((c) => c.id !== selectedCalendarId);
		const next = updated[Math.min(currentIndex, updated.length - 1)];
		setSelectedCalendarId(next.id);
		await updateMainSettings((s) => ({ ...s, calendars: updated }));
		await plugin.refreshCalendarBundles();
	}, [calendars, selectedCalendarId, updateMainSettings, plugin]);

	const handleRename = useCallback(async () => {
		if (!selectedCalendar) return;

		const newName = await openRenameModal(app, {
			title: "Rename calendar",
			initialValue: selectedCalendar.name,
			cssPrefix: "prisma-",
			testIdPrefix: "prisma-settings-calendar-",
		});

		if (newName && newName !== selectedCalendar.name) {
			await updateSelectedCalendar({ name: newName });
		}
	}, [app, selectedCalendar, updateSelectedCalendar]);

	const handleConfigure = useCallback(async () => {
		if (!selectedCalendar) return;

		const result = await openConfigureCalendarModal(app, {
			directory: selectedCalendar.directory,
			startProp: selectedCalendar.startProp,
			endProp: selectedCalendar.endProp,
			dateProp: selectedCalendar.dateProp,
		});

		if (result) {
			await updateMainSettings((s) => ({
				...s,
				calendars: s.calendars.map((cal) => (cal.id === selectedCalendarId ? { ...cal, ...result } : cal)),
			}));
		}
	}, [app, selectedCalendar, selectedCalendarId, updateMainSettings]);

	return (
		<>
			<SettingHeading name="Calendar management" />
			<div className={`${cls("calendar-management")} ${cls("calendar-management-header")}`}>
				<SettingItem name="Active calendar" description="Select which calendar to configure">
					<Dropdown value={selectedCalendarId} options={calendarOptions} onChange={setSelectedCalendarId} />
				</SettingItem>

				<div className="prisma-calendar-actions">
					<button
						type="button"
						className="prisma-calendar-action-button prisma-calendar-create-button"
						data-testid="prisma-settings-calendar-add"
						disabled={isAtMax}
						title={maxTitle}
						onClick={handleCreate}
					>
						Create new
					</button>
					<button
						type="button"
						className="prisma-calendar-action-button prisma-calendar-clone-button"
						data-testid="prisma-settings-calendar-clone"
						disabled={isAtMax}
						title={maxTitle}
						onClick={handleClone}
					>
						Clone current
					</button>
					<button
						type="button"
						className="prisma-calendar-action-button prisma-calendar-configure-button"
						data-testid="prisma-settings-calendar-configure"
						onClick={handleConfigure}
					>
						Configure current
					</button>
					<button
						type="button"
						className="prisma-calendar-action-button prisma-calendar-rename-button"
						data-testid="prisma-settings-calendar-rename"
						onClick={handleRename}
					>
						Rename current
					</button>
					<button
						type="button"
						className="prisma-calendar-action-button prisma-calendar-delete-button"
						data-testid="prisma-settings-calendar-delete"
						disabled={calendars.length <= 1}
						title={calendars.length <= 1 ? "At least one calendar is required" : undefined}
						onClick={handleDelete}
					>
						Delete current
					</button>
				</div>

				<div className="prisma-calendar-count-info">{countText}</div>
			</div>

			<div className="prisma-calendar-settings-container">
				{calendarStore ? (
					<SingleCalendarSettingsReact
						key={selectedCalendarId}
						settingsStore={calendarStore}
						plugin={plugin}
						mainSettingsStore={plugin.settingsStore}
					/>
				) : (
					<p className="setting-item-description">Calendar not found</p>
				)}
			</div>
		</>
	);
});
