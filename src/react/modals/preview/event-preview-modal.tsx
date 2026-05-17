import { calculateDuration, intoDate } from "@real1ty-obsidian-plugins";
import { cls, tid } from "../../../constants";
import { AppContext, PropertyItem, SharedReactThemeProvider, showReactModal } from "@real1ty-obsidian-plugins-react";
import { type App, TFile } from "obsidian";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { CSS_PREFIX } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { Frontmatter } from "../../../types";
import { removeZettelId } from "../../../utils/events/zettel-id";
import { categorizeProperties, formatDateOnlyDisplay, formatDateTimeDisplay } from "../../../utils/format";

export interface PreviewEventData {
	title: string;
	start: Date | null;
	end?: Date | null | undefined;
	allDay: boolean;
	extendedProps?:
		| {
				filePath?: string | undefined;
				[key: string]: unknown;
		  }
		| undefined;
}

interface EventPreviewProps {
	app: App;
	bundle: CalendarBundle;
	event: PreviewEventData;
	onClose: () => void;
}

interface PropertiesSectionProps {
	title: string;
	properties: [string, unknown][];
	onClose: () => void;
}

function loadAllFrontmatter(app: App, filePath: string | undefined): Frontmatter {
	if (!filePath) return {};
	try {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return {};
		const cache = app.metadataCache.getFileCache(file);
		return cache?.frontmatter ? { ...cache.frontmatter } : {};
	} catch (error) {
		console.error("[EventPreview] Error loading frontmatter:", error);
		return {};
	}
}

function formatPreviewDateTime(date: Date | null, allDay: boolean): string {
	if (!date || Number.isNaN(date.getTime())) return "N/A";
	return allDay ? formatDateOnlyDisplay(date) : formatDateTimeDisplay(date);
}

function PropertiesSection({ title, properties, onClose }: PropertiesSectionProps) {
	if (properties.length === 0) return null;
	return (
		<div className={`${cls("event-preview-section")} ${cls("event-preview-props-section")}`}>
			<div className={cls("event-preview-section-title")}>{title}</div>
			<div className={cls("event-preview-props-grid")}>
				{properties.map(([key, value]) => (
					<PropertyItem key={key} keyLabel={key} value={value} scope="event-preview-prop" onLinkClick={onClose} />
				))}
			</div>
		</div>
	);
}

export function EventPreviewContent({ app, bundle, event, onClose }: EventPreviewProps) {
	const filePath = event.extendedProps?.filePath;
	const allFrontmatter = loadAllFrontmatter(app, filePath);
	const settings = bundle.settingsStore.currentSettings;
	const { displayProperties, otherProperties } = categorizeProperties(allFrontmatter, settings, event.allDay);

	const title = event.title || "Untitled Event";
	const cleanTitle = removeZettelId(title);

	const handleTitleClick = () => {
		if (!filePath) return;
		void app.workspace.openLinkText(filePath, "", false);
		onClose();
	};

	const showEnd = Boolean(event.end);
	let durationLabel: string | null = null;
	if (event.start && event.end && !event.allDay) {
		const startDate = intoDate(event.start);
		const endDate = intoDate(event.end);
		if (startDate && endDate) durationLabel = calculateDuration(startDate, endDate);
	}

	return (
		<div data-testid={tid("event-preview-modal")} className={cls("event-preview-modal")}>
			<div className={cls("event-preview-header")}>
				<h2
					data-testid={tid("event-preview-title")}
					onClick={filePath ? handleTitleClick : undefined}
					style={filePath ? { cursor: "pointer" } : undefined}
				>
					{cleanTitle}
				</h2>
			</div>

			<div className={`${cls("event-preview-section")} ${cls("event-preview-time-section")}`}>
				<div className={cls("event-preview-time-grid")}>
					<div className={cls("event-preview-time-item")}>
						<div className={cls("event-preview-label")}>Start</div>
						<div className={cls("event-preview-value")}>{formatPreviewDateTime(event.start, event.allDay)}</div>
					</div>
					{showEnd && (
						<div className={cls("event-preview-time-item")}>
							<div className={cls("event-preview-label")}>End</div>
							<div className={cls("event-preview-value")}>{formatPreviewDateTime(event.end ?? null, event.allDay)}</div>
						</div>
					)}
					{durationLabel !== null && (
						<div className={cls("event-preview-time-item")}>
							<div className={cls("event-preview-label")}>Duration</div>
							<div className={cls("event-preview-value")}>{durationLabel}</div>
						</div>
					)}
				</div>
			</div>

			<PropertiesSection title="Display Properties" properties={displayProperties} onClose={onClose} />
			<PropertiesSection title="Other Properties" properties={otherProperties} onClose={onClose} />
		</div>
	);
}

export function renderEventPreviewInto(
	el: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	event: PreviewEventData,
	close: () => void
): void {
	const root = createRoot(el);
	flushSync(() => {
		root.render(
			<AppContext value={app}>
				<SharedReactThemeProvider cssPrefix={CSS_PREFIX}>
					<EventPreviewContent app={app} bundle={bundle} event={event} onClose={close} />
				</SharedReactThemeProvider>
			</AppContext>
		);
	});
}

export function showEventPreviewModal(app: App, bundle: CalendarBundle, event: PreviewEventData): void {
	showReactModal({
		app,
		cls: cls("event-preview-modal"),
		cssPrefix: CSS_PREFIX,
		render: (close) => <EventPreviewContent app={app} bundle={bundle} event={event} onClose={close} />,
	});
}
