import { cls, tid } from "@real1ty-obsidian-plugins";
import {
	Copyable,
	Dropdown,
	ObsidianIcon,
	openRenameModal,
	SettingItem,
	UpdateAvailableBadge,
	useApp,
	useSchemaField,
	useScrollRestore,
} from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useMemo, useState } from "react";

import { CSS_PREFIX } from "../../constants";
import { FREE_MAX_CALENDARS } from "../../core/license";
import { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import {
	createDefaultCalendarConfig,
	duplicateCalendarConfig,
	generateUniqueCalendarId,
} from "../../utils/calendar/settings";
import { openConfigureCalendarModal } from "../modals/calendar/configure-calendar-modal";
import { SingleCalendarSettingsReact } from "./single-calendar-settings-react";

const GITHUB_REPO_URL = "https://github.com/Real1tyy/Prisma-Calendar";

interface SettingsRootProps {
	plugin: CustomCalendarPlugin;
}

export const SettingsRoot = memo(function SettingsRoot({ plugin }: SettingsRootProps) {
	const app = useApp();
	const [calendars, setCalendars] = useSchemaField(plugin.settingsStore, "calendars");
	const [checkForReleaseUpdates] = useSchemaField(plugin.settingsStore, "checkForReleaseUpdates");
	const [selectedCalendarId, setSelectedCalendarId] = useState(() => {
		const lastUsed = plugin.syncStore.data.lastUsedCalendarId;
		if (lastUsed && calendars.some((c) => c.id === lastUsed)) return lastUsed;
		return calendars[0]?.id ?? "default";
	});
	const [managementCollapsed, setManagementCollapsed] = useState(false);

	const version = plugin.manifest.version;
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
		(patch: Partial<(typeof calendars)[number]>) => {
			setCalendars((prev) => prev.map((cal) => (cal.id === selectedCalendarId ? { ...cal, ...patch } : cal)));
		},
		[selectedCalendarId, setCalendars]
	);

	const handleCreate = useCallback(async () => {
		if (isAtMax) return;
		const newId = generateUniqueCalendarId({ calendars });
		const newName = `Planning System ${calendars.length + 1}`;
		const newCalendar = createDefaultCalendarConfig(newId, newName);
		setCalendars((prev) => [...prev, newCalendar]);
		setSelectedCalendarId(newId);
		await plugin.addCalendarBundle(newId);
	}, [isAtMax, calendars, setCalendars, plugin]);

	const handleClone = useCallback(async () => {
		if (isAtMax || !selectedCalendar) return;
		const newId = generateUniqueCalendarId({ calendars });
		const cloned = duplicateCalendarConfig(selectedCalendar, newId, `${selectedCalendar.name} (Copy)`);
		setCalendars((prev) => [...prev, cloned]);
		setSelectedCalendarId(newId);
		await plugin.addCalendarBundle(newId);
	}, [isAtMax, selectedCalendar, calendars, setCalendars, plugin]);

	const handleDelete = useCallback(async () => {
		if (calendars.length <= 1) return;
		const currentIndex = calendars.findIndex((c) => c.id === selectedCalendarId);
		if (currentIndex === -1) return;
		const deletedId = selectedCalendarId;
		const updated = calendars.filter((c) => c.id !== selectedCalendarId);
		const next = updated[Math.min(currentIndex, updated.length - 1)];
		setSelectedCalendarId(next.id);
		await plugin.removeCalendarBundle(deletedId);
		setCalendars(updated);
	}, [calendars, selectedCalendarId, setCalendars, plugin]);

	const handleRename = useCallback(async () => {
		if (!selectedCalendar) return;

		const result = await openRenameModal(app, {
			title: "Rename planning system",
			initialValue: selectedCalendar.name,
			cssPrefix: CSS_PREFIX,
			testIdPrefix: tid("settings-calendar-"),
		});

		if (result && result.value !== selectedCalendar.name) {
			updateSelectedCalendar({ name: result.value });
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
			updateSelectedCalendar(result);
		}
	}, [app, selectedCalendar, updateSelectedCalendar]);

	const scrollRef = useScrollRestore(plugin.settingsSessionState.scrollTop, ".vertical-tab-content");

	return (
		<>
			<div ref={scrollRef} className={`${cls("calendar-management")} ${cls("calendar-management-header")}`}>
				<div className={cls("settings-hero")}>
					<div className={cls("settings-hero-row")}>
						<div className={cls("settings-hero-pitch")}>
							<a href={GITHUB_REPO_URL} className={cls("settings-hero-name")}>
								Prisma
							</a>
							<span> turns any note with a date into a flexible planning system inside Obsidian.</span>
						</div>
						<div className={cls("settings-hero-controls")}>
							{checkForReleaseUpdates && (
								<UpdateAvailableBadge service={plugin.releaseCheckService} testId="prisma-settings-update-badge" />
							)}
							<Copyable text={version} className={cls("settings-hero-version")} successMessage={`Copied ${version}`}>
								v{version}
							</Copyable>
							<button
								type="button"
								className={cls("settings-hero-collapse-toggle")}
								data-testid={tid("settings-management-toggle")}
								onClick={() => setManagementCollapsed((prev) => !prev)}
								aria-label={managementCollapsed ? "Expand planning systems" : "Collapse planning systems"}
								aria-expanded={!managementCollapsed}
							>
								<ObsidianIcon icon={managementCollapsed ? "chevron-right" : "chevron-down"} />
							</button>
						</div>
					</div>
				</div>

				{!managementCollapsed && (
					<>
						<SettingItem name="Active planning system" description="Select which planning system to configure">
							<Dropdown value={selectedCalendarId} options={calendarOptions} onChange={setSelectedCalendarId} />
						</SettingItem>

						<div className={cls("calendar-actions")}>
							<button
								type="button"
								className={cls("calendar-action-button", "calendar-create-button")}
								data-testid={tid("settings-calendar-add")}
								disabled={isAtMax}
								title={maxTitle}
								onClick={() => void handleCreate()}
							>
								Create new
							</button>
							<button
								type="button"
								className={cls("calendar-action-button", "calendar-clone-button")}
								data-testid={tid("settings-calendar-clone")}
								disabled={isAtMax}
								title={maxTitle}
								onClick={() => void handleClone()}
							>
								Clone current
							</button>
							<button
								type="button"
								className={cls("calendar-action-button", "calendar-configure-button")}
								data-testid={tid("settings-calendar-configure")}
								onClick={() => void handleConfigure()}
							>
								Configure current
							</button>
							<button
								type="button"
								className={cls("calendar-action-button", "calendar-rename-button")}
								data-testid={tid("settings-calendar-rename")}
								onClick={() => void handleRename()}
							>
								Rename current
							</button>
							<button
								type="button"
								className={cls("calendar-action-button", "calendar-delete-button")}
								data-testid={tid("settings-calendar-delete")}
								disabled={calendars.length <= 1}
								title={calendars.length <= 1 ? "At least one planning system is required" : undefined}
								onClick={() => void handleDelete()}
							>
								Delete current
							</button>
						</div>

						<div className={cls("calendar-count-info")}>{countText}</div>
					</>
				)}
			</div>

			<div className={cls("calendar-settings-container")}>
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
