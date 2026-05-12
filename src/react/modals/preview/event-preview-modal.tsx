import {
	calculateDuration,
	cls,
	createDefaultSeparator,
	intoDate,
	type PropertyRendererConfig,
	renderPropertyValue,
} from "@real1ty-obsidian-plugins";
import { showReactModal } from "@real1ty-obsidian-plugins-react";
import { type App, TFile } from "obsidian";
import { useEffect, useRef } from "react";
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

interface PropertyItemProps {
	app: App;
	propKey: string;
	value: unknown;
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

function PropertyItem({ app, propKey, value, onClose }: PropertyItemProps) {
	const valueRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = valueRef.current;
		if (!el) return;
		el.replaceChildren();
		const config: PropertyRendererConfig = {
			createLink: (text, path) => {
				const link = document.createElement("a");
				link.textContent = text;
				link.className = cls("event-preview-prop-value-link");
				link.onclick = (e) => {
					e.preventDefault();
					void app.workspace.openLinkText(path, "", false);
					onClose();
				};
				return link;
			},
			createText: (text) => document.createTextNode(text),
			createSeparator: createDefaultSeparator,
		};
		renderPropertyValue(el, value, config);
	}, [app, value, onClose]);

	return (
		<div className={cls("event-preview-prop-item")}>
			<div className={cls("event-preview-prop-key")}>{propKey}</div>
			<div ref={valueRef} className={cls("event-preview-prop-value")} />
		</div>
	);
}

interface PropertiesSectionProps {
	app: App;
	title: string;
	properties: [string, unknown][];
	onClose: () => void;
}

function PropertiesSection({ app, title, properties, onClose }: PropertiesSectionProps) {
	if (properties.length === 0) return null;
	return (
		<div className={`${cls("event-preview-section")} ${cls("event-preview-props-section")}`}>
			<div className={cls("event-preview-section-title")}>{title}</div>
			<div className={cls("event-preview-props-grid")}>
				{properties.map(([key, value]) => (
					<PropertyItem key={key} app={app} propKey={key} value={value} onClose={onClose} />
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
		<div data-testid="prisma-event-preview-modal" className={cls("event-preview-modal")}>
			<div className={cls("event-preview-header")}>
				<h2
					data-testid="prisma-event-preview-title"
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

			<PropertiesSection app={app} title="Display Properties" properties={displayProperties} onClose={onClose} />
			<PropertiesSection app={app} title="Other Properties" properties={otherProperties} onClose={onClose} />
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
		root.render(<EventPreviewContent app={app} bundle={bundle} event={event} onClose={close} />);
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
