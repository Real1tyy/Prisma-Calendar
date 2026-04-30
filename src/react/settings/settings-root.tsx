import { cls } from "@real1ty-obsidian-plugins";
import {
	Copyable,
	Dropdown,
	openRenameModal,
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

const GITHUB_REPO_URL = "https://github.com/Real1tyy/Prisma-Calendar";

interface SettingsRootProps {
	plugin: CustomCalendarPlugin;
}

export const SettingsRoot = memo(function SettingsRoot({ plugin }: SettingsRootProps) {
	const app = useApp();
	const [mainSettings, updateMainSettings] = useSettingsStore(plugin.settingsStore);
	const [selectedCalendarId, setSelectedCalendarId] = useState(() => {
		const lastUsed = plugin.syncStore.data.lastUsedCalendarId;
		if (lastUsed && mainSettings.calendars.some((c) => c.id === lastUsed)) return lastUsed;
		return mainSettings.calendars[0]?.id ?? "default";
	});

	const version = plugin.manifest?.version ?? "?";
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
		maxCalendars === Infinity
			? `${calendars.length} planning systems`
			: `${calendars.length}/${maxCalendars} planning systems`;
	const maxTitle = isAtMax
		? `Free plan allows up to ${maxCalendars} planning systems. Start your 30-day free trial for unlimited.`
		: undefined;

	const updateSelectedCalendar = useCallback(
		async (patch: Partial<(typeof calendars)[number]>) => {
			await updateMainSettings((s) => ({
				...s,
				calendars: s.calendars.map((cal) => (cal.id === selectedCalendarId ? { ...cal, ...patch } : cal)),
			}));
		},
		[selectedCalendarId, updateMainSettings]
	);

	const handleCreate = useCallback(async () => {
		if (isAtMax) return;
		const newId = generateUniqueCalendarId(mainSettings);
		const newName = `Planning System ${calendars.length + 1}`;
		const newCalendar = createDefaultCalendarConfig(newId, newName);
		await updateMainSettings((s) => ({ ...s, calendars: [...s.calendars, newCalendar] }));
		setSelectedCalendarId(newId);
		await plugin.addCalendarBundle(newId);
	}, [isAtMax, mainSettings, calendars.length, updateMainSettings, plugin]);

	const handleClone = useCallback(async () => {
		if (isAtMax || !selectedCalendar) return;
		const newId = generateUniqueCalendarId(mainSettings);
		const cloned = duplicateCalendarConfig(selectedCalendar, newId, `${selectedCalendar.name} (Copy)`);
		await updateMainSettings((s) => ({ ...s, calendars: [...s.calendars, cloned] }));
		setSelectedCalendarId(newId);
		await plugin.addCalendarBundle(newId);
	}, [isAtMax, selectedCalendar, mainSettings, updateMainSettings, plugin]);

	const handleDelete = useCallback(async () => {
		if (calendars.length <= 1) return;
		const currentIndex = calendars.findIndex((c) => c.id === selectedCalendarId);
		if (currentIndex === -1) return;
		const deletedId = selectedCalendarId;
		const updated = calendars.filter((c) => c.id !== selectedCalendarId);
		const next = updated[Math.min(currentIndex, updated.length - 1)];
		setSelectedCalendarId(next.id);
		await plugin.removeCalendarBundle(deletedId);
		await updateMainSettings((s) => ({ ...s, calendars: updated }));
	}, [calendars, selectedCalendarId, updateMainSettings, plugin]);

	const handleRename = useCallback(async () => {
		if (!selectedCalendar) return;

		const newName = await openRenameModal(app, {
			title: "Rename planning system",
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
			<div className={`${cls("calendar-management")} ${cls("calendar-management-header")}`}>
				<div className={cls("settings-hero")}>
					<div className={cls("settings-hero-row")}>
						<div className={cls("settings-hero-pitch")}>
							<a href={GITHUB_REPO_URL} className={cls("settings-hero-name")}>
								Prisma
							</a>
							<span> turns any note with a date into a flexible planning system inside Obsidian.</span>
						</div>
						<Copyable text={version} className={cls("settings-hero-version")} successMessage={`Copied ${version}`}>
							v{version}
						</Copyable>
					</div>
				</div>

				<SettingItem name="Active planning system" description="Select which planning system to configure">
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
						title={calendars.length <= 1 ? "At least one planning system is required" : undefined}
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
					<p className="setting-item-description">Planning system not found</p>
				)}
			</div>
		</>
	);
});
