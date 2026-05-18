import { formatLocaleLongDate, formatLocaleLongDateTime, formatLocaleTimeHm } from "@real1ty-obsidian-plugins";
import { AppContext, PropertyItem, SharedReactThemeProvider, showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { cls, CSS_PREFIX, tid } from "../../../constants";
import type { Frontmatter } from "../../../types";
import type { SingleCalendarConfig } from "../../../types/settings";
import { removeZettelId } from "../../../utils/events/zettel-id";
import { categorizeProperties } from "../../../utils/format";

export interface NotificationEventData {
	title: string;
	filePath: string;
	startDate: Date;
	isAllDay: boolean;
	frontmatter: Frontmatter;
}

interface NotificationProps {
	app: App;
	eventData: NotificationEventData;
	settings: SingleCalendarConfig;
	onClose: () => void;
	onSnooze?: (() => void) | undefined;
}

function getTimingInfo(eventData: NotificationEventData): string {
	const now = new Date();
	const eventTime = eventData.startDate;
	const diffMs = eventTime.getTime() - now.getTime();
	const diffMinutes = Math.round(diffMs / (1000 * 60));

	if (eventData.isAllDay) {
		if (diffMinutes <= 0) return "Event is today";
		const diffDays = Math.ceil(diffMinutes / (24 * 60));
		if (diffDays === 1) return "Event is tomorrow";
		return `Event in ${diffDays} days`;
	}

	if (diffMinutes <= 0) {
		return `Event started at ${formatLocaleTimeHm(eventTime)}`;
	}
	if (diffMinutes < 60) {
		return `In ${diffMinutes} minutes → at ${formatLocaleTimeHm(eventTime)}`;
	}
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) {
		return `In ${diffHours} hours → at ${formatLocaleTimeHm(eventTime)}`;
	}
	const diffDays = Math.round(diffHours / 24);
	return `In ${diffDays} days → ${eventTime.toLocaleDateString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})}`;
}

function formatNotificationDateTime(date: Date | null, allDay: boolean): string {
	if (!date) return "N/A";
	return allDay ? formatLocaleLongDate(date) : formatLocaleLongDateTime(date);
}

interface NotificationPropertiesSectionProps {
	title: string;
	properties: [string, unknown][];
	onClose: () => void;
}

function NotificationPropertiesSection({ title, properties, onClose }: NotificationPropertiesSectionProps) {
	if (properties.length === 0) return null;
	return (
		<div className={cls("event-notification-section")}>
			<div className={cls("event-notification-section-title")}>{title}</div>
			<div className={cls("event-notification-props-grid")}>
				{properties.map(([key, value]) => (
					<PropertyItem key={key} keyLabel={key} value={value} scope="event-notification-prop" onLinkClick={onClose} />
				))}
			</div>
		</div>
	);
}

interface SnoozeControlProps {
	defaultMinutes: number;
	onSnooze: () => void;
	onClose: () => void;
}

function SnoozeControl({ defaultMinutes, onSnooze, onClose }: SnoozeControlProps) {
	const [value, setValue] = useState(String(defaultMinutes));

	const submit = () => {
		const minutes = Number.parseInt(value, 10);
		if (Number.isNaN(minutes) || minutes < 1) {
			setValue(String(defaultMinutes));
			return;
		}
		onSnooze();
		onClose();
	};

	return (
		<div className={cls("event-notification-snooze-container")}>
			<button type="button" onClick={submit}>
				Snooze
			</button>
			<div className={cls("event-notification-snooze-input-group")}>
				<input
					type="number"
					value={value}
					min={1}
					max={1440}
					className={cls("event-notification-snooze-input")}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") submit();
					}}
				/>
				<span className={cls("event-notification-snooze-unit")}>Min</span>
			</div>
		</div>
	);
}

export function NotificationContent({ app, eventData, settings, onClose, onSnooze }: NotificationProps) {
	const cleanTitle = removeZettelId(eventData.title);
	const { displayProperties, otherProperties } = categorizeProperties(
		eventData.frontmatter,
		settings,
		eventData.isAllDay
	);

	const handleTitleClick = () => {
		void app.workspace.openLinkText(eventData.filePath, "", false);
		onClose();
	};

	const handleFileClick = () => {
		void app.workspace.openLinkText(eventData.filePath, "", false);
		onClose();
	};

	const showSnooze = Boolean(onSnooze && !eventData.isAllDay);

	return (
		<div className={cls("event-notification-modal")}>
			<div className={cls("event-notification-header")}>
				<div className={cls("event-notification-timing")}>{getTimingInfo(eventData)}</div>
				<h2 className={cls("event-notification-title")} onClick={handleTitleClick} style={{ cursor: "pointer" }}>
					🔔 {cleanTitle}
				</h2>
			</div>

			<div className={cls("event-notification-section")}>
				<div className={cls("event-notification-time-grid")}>
					<div className={cls("event-notification-time-item")}>
						<div className={cls("event-notification-label")}>Start</div>
						<div className={cls("event-notification-value")}>
							{formatNotificationDateTime(eventData.startDate, eventData.isAllDay)}
						</div>
					</div>
					<div className={cls("event-notification-time-item")}>
						<div className={cls("event-notification-label")}>File</div>
						<div
							className={`${cls("event-notification-value")} ${cls("event-notification-file-link")}`}
							onClick={handleFileClick}
							style={{ cursor: "pointer" }}
						>
							{eventData.filePath}
						</div>
					</div>
				</div>
			</div>

			<NotificationPropertiesSection title="Event Properties" properties={displayProperties} onClose={onClose} />
			<NotificationPropertiesSection title="Additional Properties" properties={otherProperties} onClose={onClose} />

			<div className={cls("event-notification-buttons")}>
				<button type="button" className="mod-cta" data-testid={tid("notification-open")} onClick={handleFileClick}>
					Open event
				</button>
				{showSnooze && onSnooze && (
					<SnoozeControl defaultMinutes={settings.snoozeMinutes} onSnooze={onSnooze} onClose={onClose} />
				)}
				<button type="button" data-testid={tid("notification-dismiss")} onClick={onClose}>
					Dismiss
				</button>
			</div>
		</div>
	);
}

export function renderNotificationContentInto(
	el: HTMLElement,
	app: App,
	eventData: NotificationEventData,
	settings: SingleCalendarConfig,
	close: () => void,
	onSnooze?: () => void
): void {
	const root = createRoot(el);
	flushSync(() => {
		root.render(
			<AppContext value={app}>
				<SharedReactThemeProvider cssPrefix={CSS_PREFIX}>
					<NotificationContent
						app={app}
						eventData={eventData}
						settings={settings}
						onClose={close}
						onSnooze={onSnooze}
					/>
				</SharedReactThemeProvider>
			</AppContext>
		);
	});
}

export function showNotificationModal(
	app: App,
	eventData: NotificationEventData,
	settings: SingleCalendarConfig,
	onSnooze?: () => void
): void {
	showReactModal({
		app,
		cls: cls("event-notification-modal"),
		cssPrefix: CSS_PREFIX,
		testId: tid("notification-modal"),
		render: (close) => (
			<NotificationContent app={app} eventData={eventData} settings={settings} onClose={close} onSnooze={onSnooze} />
		),
	});
}
