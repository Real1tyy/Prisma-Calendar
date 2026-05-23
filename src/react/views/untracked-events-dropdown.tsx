import { Draggable } from "@fullcalendar/interaction";
import type { ColorEvaluator } from "@real1ty-obsidian-plugins";
import {
	PropertyValue,
	useApp,
	useColorEvaluator,
	useEscapeKey,
	useFocusOnMount,
	useOutsideClick,
	useSettingsFields,
	useSubscription,
	VirtualList,
} from "@real1ty-obsidian-plugins-react";
import {
	forwardRef,
	memo,
	useCallback,
	useDeferredValue,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { debounceTime } from "rxjs";

import { cls, tid } from "../../constants";
import { openCreateUntrackedEventModal } from "../../core/api/modal-actions";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { MinimizedModalManager } from "../../core/minimized-modal-manager";
import type { ParsedEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { removeZettelId } from "../../utils/events/zettel-id";
import { normalizeFrontmatterForColorEvaluation } from "../../utils/filters/expressions";
import { getDisplayProperties } from "../../utils/frontmatter/display";
import { useDropdownDragInteraction } from "./hooks/use-dropdown-drag-interaction";

const SEARCH_FOCUS_DELAY_MS = 50;
const REFRESH_DEBOUNCE_MS = 300;
const ITEM_ESTIMATE_PX = 60;

export interface UntrackedEventsDropdownHandle {
	toggle(): void;
	restoreIfTemporarilyHidden(): void;
	ignoreOutsideClicksFor(ms: number): void;
}

interface UntrackedEventsDropdownProps {
	bundle: CalendarBundle;
}

export const UntrackedEventsDropdown = memo(
	forwardRef<UntrackedEventsDropdownHandle, UntrackedEventsDropdownProps>(function UntrackedEventsDropdown(
		{ bundle },
		ref
	) {
		const app = useApp();
		const [settings] = useSettingsFields(bundle.settingsStore, [
			"showStopwatch",
			"colorRules",
			"frontmatterDisplayPropertiesUntracked",
		]);
		const [isOpen, setIsOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const deferredQuery = useDeferredValue(searchQuery);
		const [allEvents, setAllEvents] = useState<ParsedEvent[]>(() => bundle.untrackedEventStore.getUntrackedEvents());

		const dropdownRef = useRef<HTMLDivElement>(null);
		const buttonRef = useRef<HTMLButtonElement>(null);
		const searchInputRef = useRef<HTMLInputElement>(null);

		const interaction = useDropdownDragInteraction({ dropdownRef, isOpen });

		const colorEvaluator = useColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);

		const untrackedChanges$ = useMemo(
			() => bundle.untrackedEventStore.changes$.pipe(debounceTime(REFRESH_DEBOUNCE_MS)),
			[bundle]
		);
		useSubscription(untrackedChanges$, () => {
			interaction.bumpAfterRefresh();
			setAllEvents(bundle.untrackedEventStore.getUntrackedEvents());
		});

		const filteredEvents = useMemo(() => {
			if (!deferredQuery) return allEvents;
			const lower = deferredQuery.toLowerCase();
			return allEvents.filter((e) => removeZettelId(e.title).toLowerCase().includes(lower));
		}, [allEvents, deferredQuery]);

		const close = useCallback(() => {
			interaction.resetTempHide();
			setIsOpen(false);
			setSearchQuery("");
		}, [interaction]);

		const toggle = useCallback(() => {
			interaction.resetTempHide();
			setIsOpen((prev) => {
				if (prev) setSearchQuery("");
				return !prev;
			});
		}, [interaction]);

		useImperativeHandle(
			ref,
			() => ({
				toggle,
				restoreIfTemporarilyHidden: interaction.resetTempHide,
				ignoreOutsideClicksFor: interaction.ignoreOutsideClicksFor,
			}),
			[toggle, interaction]
		);

		useOutsideClick([dropdownRef, buttonRef], close, {
			event: "click",
			enabled: isOpen,
			shouldIgnore: interaction.shouldIgnoreOutsideClick,
		});

		useEscapeKey(
			useCallback(
				(e: KeyboardEvent) => {
					if (!isOpen) return;
					e.preventDefault();
					e.stopPropagation();
					if (activeDocument.activeElement === searchInputRef.current && searchQuery) {
						setSearchQuery("");
						return;
					}
					close();
				},
				[isOpen, searchQuery, close]
			)
		);

		useFocusOnMount(searchInputRef, { delayMs: SEARCH_FOCUS_DELAY_MS, enabled: isOpen });

		useEffect(() => {
			if (!isOpen) return;
			const dropEl = dropdownRef.current;
			const calCont = dropEl?.closest(".prisma-calendar-container");
			if (dropEl && calCont) {
				const available = calCont.getBoundingClientRect().right - dropEl.getBoundingClientRect().left;
				dropEl.style.setProperty("--dropdown-max-width", `${available}px`);
			}
		}, [isOpen]);

		useEffect(() => {
			if (!isOpen) return;
			const dropEl = dropdownRef.current;
			if (!dropEl) return;
			const draggable = new Draggable(dropEl, {
				itemSelector: ".prisma-untracked-dropdown-item",
				eventData: (eventEl) => {
					const filePath = eventEl.getAttribute("data-file-path");
					const titleEl = eventEl.querySelector(".prisma-untracked-dropdown-item-title");
					const title = titleEl?.textContent || "Untitled";
					return {
						title,
						extendedProps: { filePath, isUntrackedDrop: true },
					};
				},
			});
			return () => draggable.destroy();
		}, [isOpen]);

		const handleCreate = useCallback(() => {
			close();
			openCreateUntrackedEventModal(bundle.plugin);
		}, [bundle, close]);

		const handleStartStopwatch = useCallback(
			(event: ParsedEvent) => {
				close();
				MinimizedModalManager.startStopwatchSession(app, bundle, {
					title: removeZettelId(event.title),
					start: new Date(),
					allDay: false,
					extendedProps: { filePath: event.ref.filePath },
				});
			},
			[app, bundle, close]
		);

		const handleDoubleClick = useCallback(
			(filePath: string) => void app.workspace.openLinkText(filePath, "", false),
			[app]
		);

		const renderItem = useCallback(
			(event: ParsedEvent) => (
				<UntrackedEventItem
					event={event}
					settings={settings}
					colorEvaluator={colorEvaluator}
					showStopwatch={settings.showStopwatch}
					onStartStopwatch={handleStartStopwatch}
					onDoubleClick={handleDoubleClick}
					onClose={close}
				/>
			),
			[settings, colorEvaluator, handleStartStopwatch, handleDoubleClick, close]
		);

		const getKey = useCallback((event: ParsedEvent) => event.ref.filePath, []);

		return (
			<>
				<button
					ref={buttonRef}
					type="button"
					className={`${cls("untracked-dropdown-button", isOpen ? "active" : "")} fc-button fc-button-primary`}
					title="Untracked events"
					data-testid={tid("untracked-dropdown-button")}
					onClick={(e) => {
						e.stopPropagation();
						toggle();
					}}
				>
					⋮
				</button>

				{isOpen && (
					<div ref={dropdownRef} className={cls("untracked-dropdown")} data-testid={tid("untracked-dropdown")}>
						<button
							type="button"
							className={cls("untracked-dropdown-create-btn")}
							data-testid={tid("untracked-create")}
							onClick={(e) => {
								e.stopPropagation();
								handleCreate();
							}}
						>
							+ Create untracked event
						</button>

						<div className={cls("untracked-dropdown-search")}>
							<input
								ref={searchInputRef}
								type="text"
								className={cls("untracked-dropdown-search-input")}
								placeholder="Search untracked events..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								onClick={(e) => e.stopPropagation()}
								data-testid={tid("untracked-search")}
							/>
						</div>

						{filteredEvents.length === 0 ? (
							<div className={cls("untracked-dropdown-list")}>
								<div className={cls("untracked-dropdown-empty")}>
									{allEvents.length === 0 ? "No untracked events" : "No events match your search"}
								</div>
							</div>
						) : (
							<VirtualList
								items={filteredEvents}
								estimateSize={ITEM_ESTIMATE_PX}
								renderItem={renderItem}
								getKey={getKey}
								className={cls("untracked-dropdown-list")}
								style={{ flex: 1, minHeight: 0, overflow: "hidden auto" }}
							/>
						)}
					</div>
				)}
			</>
		);
	})
);

type UntrackedEventItemSettings = Pick<SingleCalendarConfig, "colorRules" | "frontmatterDisplayPropertiesUntracked">;

interface UntrackedEventItemProps {
	event: ParsedEvent;
	settings: UntrackedEventItemSettings;
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	showStopwatch: boolean;
	onStartStopwatch: (event: ParsedEvent) => void;
	onDoubleClick: (filePath: string) => void;
	onClose: () => void;
}

const UntrackedEventItem = memo(function UntrackedEventItem({
	event,
	settings,
	colorEvaluator,
	showStopwatch,
	onStartStopwatch,
	onDoubleClick,
	onClose,
}: UntrackedEventItemProps) {
	const color = useMemo(() => {
		const normalized = normalizeFrontmatterForColorEvaluation(
			event.meta,
			settings.colorRules.map((r) => ({ expression: r.expression, enabled: r.enabled }))
		);
		return colorEvaluator.evaluateColor(normalized);
	}, [event.meta, settings.colorRules, colorEvaluator]);

	const displayProps = useMemo(
		() => getDisplayProperties(event.meta, settings.frontmatterDisplayPropertiesUntracked),
		[event.meta, settings.frontmatterDisplayPropertiesUntracked]
	);

	return (
		<div
			className={`${cls("untracked-dropdown-item")} fc-event`}
			style={color ? ({ "--event-color": color } as CSSProperties) : undefined}
			data-testid={tid("untracked-dropdown-item")}
			data-file-path={event.ref.filePath}
			onDoubleClick={(e) => {
				e.stopPropagation();
				onDoubleClick(event.ref.filePath);
			}}
		>
			<div className={cls("untracked-dropdown-item-title")}>{removeZettelId(event.title)}</div>

			{displayProps.length > 0 && (
				<div className={cls("untracked-dropdown-item-props")}>
					{displayProps.map(([key, value]) => (
						<span key={key} className={cls("untracked-dropdown-item-prop")}>
							<span className={cls("prop-key")}>{key}: </span>
							<span
								className={cls("prop-value")}
								onPointerDown={(e) => e.stopPropagation()}
								onMouseDown={(e) => e.stopPropagation()}
								onTouchStart={(e) => e.stopPropagation()}
							>
								<PropertyValue value={value} linkClassName={cls("prop-link")} onLinkClick={onClose} />
							</span>
						</span>
					))}
				</div>
			)}

			{showStopwatch && (
				<button
					type="button"
					className={cls("untracked-dropdown-item-stopwatch")}
					title="Start tracking"
					aria-label="Start tracking"
					data-testid={tid("untracked-dropdown-item-start")}
					onPointerDown={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					onTouchStart={(e) => e.stopPropagation()}
					onClick={(e) => {
						e.stopPropagation();
						onStartStopwatch(event);
					}}
				>
					▶
				</button>
			)}
		</div>
	);
});
