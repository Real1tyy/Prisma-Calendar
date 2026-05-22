import { activateView } from "@real1ty-obsidian-plugins";
import { Notice } from "obsidian";

import { AI_CHAT_VIEW_TYPE } from "./components/ai-chat-view";
import type { CalendarComponent } from "./components/calendar-view";
import { COMMAND_IDS } from "./constants";
import { MinimizedModalManager } from "./core";
import {
	addZettelIdToActiveNote,
	duplicateCurrentEvent,
	openCreateEventModal,
	openCreateUntrackedEventModal,
	openEditActiveNoteModal,
	triggerCurrentEventStopwatch,
} from "./core/api/modal-actions";
import { redo, undo } from "./core/api/read-operations";
import { PRO_FEATURES } from "./core/license";
import { getProGateUrls } from "./core/pro-feature-previews";
import type CustomCalendarPlugin from "./main";
import { openFilteredEventsModal, openGlobalSearchModal } from "./react/modals/event-list";
import { openEventsModal } from "./react/modals/event-list/events-modal-content";
import { startPrismaTour } from "./react/onboarding/prisma-tour";

type CalendarComponentAction = (component: CalendarComponent) => void;

export function registerPrismaCalendarCommands(plugin: CustomCalendarPlugin): void {
	const addCalendarViewCommand = (id: string, name: string, action: CalendarComponentAction): void => {
		plugin.addCommand({
			id,
			name,
			checkCallback: (checking: boolean) => {
				const component = plugin.getActiveCalendarComponent();
				if (component) {
					if (!checking) {
						action(component);
					}
					return true;
				}
				return false;
			},
		});
	};

	const addBatchCommand = (id: string, name: string, action: CalendarComponentAction): void => {
		plugin.addCommand({
			id,
			name: `Batch: ${name}`,
			checkCallback: (checking: boolean) => {
				const component = plugin.getActiveCalendarComponent();
				if (component?.isInBatchSelectionMode()) {
					if (!checking) {
						action(component);
					}
					return true;
				}
				if (component && !component.isInBatchSelectionMode()) {
					if (!checking) {
						new Notice("Prisma Calendar: batch selection mode is not active");
					}
					return true;
				}
				return false;
			},
		});
	};

	const addApiCommand = (id: string, name: string, action: () => void): void => {
		plugin.addCommand({
			id,
			name,
			callback: action,
		});
	};

	const addMinimizedModalCommand = (id: string, name: string, action: () => void): void => {
		plugin.addCommand({
			id,
			name,
			checkCallback: (checking: boolean) => {
				if (!MinimizedModalManager.hasMinimizedModal()) return false;
				if (!checking) action();
				return true;
			},
		});
	};

	addBatchCommand(COMMAND_IDS.BATCH_SELECT_ALL, "Select all", (view) => view.selectAll());
	addBatchCommand(COMMAND_IDS.BATCH_CLEAR_SELECTION, "Clear selection", (view) => view.clearSelection());
	addBatchCommand(COMMAND_IDS.BATCH_DUPLICATE_SELECTION, "Duplicate selection", (view) => view.duplicateSelection());
	addBatchCommand(COMMAND_IDS.BATCH_DELETE_SELECTION, "Delete selection", (view) => view.deleteSelection());
	addBatchCommand(COMMAND_IDS.BATCH_SKIP_SELECTION, "Skip selection", (view) => view.skipSelection());
	addBatchCommand(COMMAND_IDS.BATCH_MARK_AS_DONE, "Mark selection as done", (view) => view.markAsDoneSelection());
	addBatchCommand(COMMAND_IDS.BATCH_MARK_AS_NOT_DONE, "Mark selection as not done", (view) =>
		view.markAsNotDoneSelection()
	);
	addBatchCommand(COMMAND_IDS.BATCH_ASSIGN_CATEGORIES, "Assign categories to selection", (view) => {
		void view.openCategoryAssignModal();
	});
	addBatchCommand(COMMAND_IDS.BATCH_UPDATE_FRONTMATTER, "Update frontmatter for selection", (view) => {
		void view.openBatchFrontmatterModal();
	});
	addBatchCommand(COMMAND_IDS.BATCH_OPEN_SELECTION, "Open selection", (view) => view.openSelection());
	addBatchCommand(COMMAND_IDS.BATCH_CLONE_NEXT_WEEK, "Clone to next week", (view) => view.cloneSelection(1));
	addBatchCommand(COMMAND_IDS.BATCH_CLONE_PREV_WEEK, "Clone to previous week", (view) => view.cloneSelection(-1));
	addBatchCommand(COMMAND_IDS.BATCH_MOVE_NEXT_WEEK, "Move to next week", (view) => view.moveSelection(1));
	addBatchCommand(COMMAND_IDS.BATCH_MOVE_PREV_WEEK, "Move to previous week", (view) => view.moveSelection(-1));

	addApiCommand(COMMAND_IDS.UNDO, "Undo", () => {
		void undo(plugin).then((success) => {
			if (!success) new Notice("Nothing to undo");
		});
	});
	addApiCommand(COMMAND_IDS.REDO, "Redo", () => {
		void redo(plugin).then((success) => {
			if (!success) new Notice("Nothing to redo");
		});
	});

	addApiCommand(COMMAND_IDS.START_TUTORIAL, "Start onboarding tutorial", () => {
		startPrismaTour(plugin);
	});

	addApiCommand(COMMAND_IDS.CREATE_EVENT, "Create new event", () => {
		void openCreateEventModal(plugin, undefined, false, true);
	});
	addApiCommand(COMMAND_IDS.CREATE_EVENT_WITH_STOPWATCH, "Create new event with stopwatch", () => {
		void openCreateEventModal(plugin, undefined, true, true);
	});
	addApiCommand(COMMAND_IDS.CREATE_UNTRACKED_EVENT, "Create new untracked event", () => {
		openCreateUntrackedEventModal(plugin);
	});
	addApiCommand(COMMAND_IDS.EDIT_CURRENT_NOTE_AS_EVENT, "Edit current note as event", () => {
		void openEditActiveNoteModal(plugin);
	});
	addApiCommand(COMMAND_IDS.ADD_ZETTEL_ID_TO_CURRENT_NOTE, "Add ZettelID to current note", () => {
		void addZettelIdToActiveNote(plugin);
	});
	addApiCommand(COMMAND_IDS.DUPLICATE_CURRENT_EVENT, "Duplicate current event", () => {
		void duplicateCurrentEvent(plugin);
	});
	addApiCommand(COMMAND_IDS.TRIGGER_CURRENT_EVENT_STOPWATCH, "Trigger current event stopwatch", () => {
		void triggerCurrentEventStopwatch(plugin);
	});
	addCalendarViewCommand(COMMAND_IDS.EDIT_LAST_FOCUSED_EVENT, "Edit last focused event", (view) => {
		view.openEditModalForFocusedEvent();
	});
	addCalendarViewCommand(
		COMMAND_IDS.SET_LAST_FOCUSED_EVENT_START_TO_NOW,
		"Set start time to now (focused event)",
		(view) => {
			view.setFocusedEventStartToNow();
		}
	);
	addCalendarViewCommand(
		COMMAND_IDS.SET_LAST_FOCUSED_EVENT_END_TO_NOW,
		"Set end time to now (focused event)",
		(view) => {
			view.setFocusedEventEndToNow();
		}
	);
	addCalendarViewCommand(
		COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_START_FROM_PREVIOUS,
		"Fill start time from previous event (focused event)",
		(view) => {
			view.fillFocusedEventStartFromPrevious();
		}
	);
	addCalendarViewCommand(
		COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_END_FROM_NEXT,
		"Fill end time from next event (focused event)",
		(view) => {
			view.fillFocusedEventEndFromNext();
		}
	);
	addCalendarViewCommand(COMMAND_IDS.TOGGLE_BATCH_SELECTION, "Toggle batch selection", (view) => {
		view.toggleBatchSelection();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_SKIPPED_EVENTS, "Show skipped events", (view) => {
		view.showSkippedEventsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_RECURRING_EVENTS, "Show recurring events", (view) => {
		openEventsModal(view.app, view.getBundle(), view);
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_FILTERED_EVENTS, "Show filtered events", (view) => {
		openFilteredEventsModal(view.app, view.getBundle(), view.filteredEvents);
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_UNTRACKED_EVENTS, "Toggle untracked events dropdown", (view) => {
		view.toggleUntrackedEventsDropdown();
	});
	addCalendarViewCommand(COMMAND_IDS.GLOBAL_SEARCH, "Global event search", (view) => {
		openGlobalSearchModal(view.app, view.getBundle(), view);
	});
	addCalendarViewCommand(COMMAND_IDS.FOCUS_SEARCH, "Focus search", (view) => {
		void view.focusSearch();
	});
	addCalendarViewCommand(COMMAND_IDS.FOCUS_EXPRESSION_FILTER, "Focus expression filter", (view) => {
		void view.focusExpressionFilter();
	});
	addCalendarViewCommand(COMMAND_IDS.OPEN_FILTER_PRESET_SELECTOR, "Open filter preset selector", (view) => {
		void view.openFilterPresetSelector();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_DAILY_STATS, "Show daily statistics", (view) => {
		void view.showDailyStatsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_WEEKLY_STATS, "Show weekly statistics", (view) => {
		void view.showWeeklyStatsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_MONTHLY_STATS, "Show monthly statistics", (view) => {
		void view.showMonthlyStatsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_ALLTIME_STATS, "Show all-time statistics", (view) => {
		void view.showAllTimeStatsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.REFRESH_CALENDAR, "Refresh planning system", (view) => {
		view.getBundle().refreshCalendar();
	});
	addCalendarViewCommand(
		COMMAND_IDS.HIGHLIGHT_EVENTS_WITHOUT_CATEGORIES,
		"Highlight events without categories",
		(view) => {
			view.highlightEventsWithoutCategories();
		}
	);
	addCalendarViewCommand(COMMAND_IDS.HIGHLIGHT_EVENTS_WITH_CATEGORY, "Highlight events with category", (view) => {
		view.showCategorySelectModal();
	});
	addCalendarViewCommand(COMMAND_IDS.NAVIGATE_BACK, "Navigate back", (view) => {
		view.navigateBack();
	});
	addCalendarViewCommand(COMMAND_IDS.NAVIGATE_FORWARD, "Navigate forward", (view) => {
		view.navigateForward();
	});
	addCalendarViewCommand(COMMAND_IDS.SHOW_INTERVAL_BASES, "Show current interval in Bases", (view) => {
		void view.showIntervalEventsModal();
	});
	addCalendarViewCommand(COMMAND_IDS.GO_TO_TODAY, "Go to today", (view) => {
		view.goToToday();
	});
	addCalendarViewCommand(COMMAND_IDS.SCROLL_TO_NOW, "Scroll to current time", (view) => {
		view.scrollToNow();
	});
	addCalendarViewCommand(
		COMMAND_IDS.TOGGLE_PREREQUISITE_CONNECTIONS,
		"Toggle prerequisite connection arrows",
		(view) => {
			view.toggleConnections();
		}
	);
	plugin.addCommand({
		id: COMMAND_IDS.SHOW_ALL_EVENTS_TIMELINE,
		name: "Show all events timeline",
		checkCallback: (checking) => {
			const bundle = plugin.getActiveBundleFromLeaf();
			if (!bundle) return false;
			if (!checking) {
				bundle.viewRef.tabbedHandle?.switchTo("timeline");
			}
			return true;
		},
	});
	plugin.addCommand({
		id: COMMAND_IDS.SHOW_ALL_EVENTS_HEATMAP,
		name: "Show all events heatmap",
		checkCallback: (checking) => {
			const bundle = plugin.getActiveBundleFromLeaf();
			if (!bundle) return false;
			if (!checking) {
				if (!plugin.licenseManager.requirePro(PRO_FEATURES.HEATMAP, getProGateUrls("HEATMAP"))) return true;
				bundle.viewRef.tabbedHandle?.switchTo("heatmap");
			}
			return true;
		},
	});

	plugin.addCommand({
		id: COMMAND_IDS.EXPORT_CALENDAR_ICS,
		name: "Export calendar as .ics",
		callback: () => {
			plugin.showCalendarExportModal();
		},
	});

	plugin.addCommand({
		id: COMMAND_IDS.IMPORT_CALENDAR_ICS,
		name: "Import .ics file",
		callback: () => {
			void plugin.showCalendarImportModal();
		},
	});

	plugin.addCommand({
		id: COMMAND_IDS.SYNC_CALDAV,
		name: "Sync calendar accounts",
		callback: async () => {
			if (!plugin.licenseManager.requirePro(PRO_FEATURES.CALDAV_SYNC, getProGateUrls("CALDAV_SYNC"))) {
				return;
			}
			const caldavAccounts = plugin.settingsStore.currentSettings.caldav.accounts;
			for (const account of caldavAccounts) {
				if (account.enabled) {
					await plugin.syncSingleAccount(account);
				}
			}
		},
	});

	plugin.addCommand({
		id: COMMAND_IDS.SYNC_ICS_SUBSCRIPTIONS,
		name: "Sync ICS subscriptions",
		callback: async () => {
			if (!plugin.licenseManager.requirePro(PRO_FEATURES.ICS_SYNC, getProGateUrls("ICS_SYNC"))) {
				return;
			}
			const subscriptions = plugin.settingsStore.currentSettings.icsSubscriptions.subscriptions;
			for (const sub of subscriptions) {
				if (sub.enabled) {
					await plugin.syncSingleICSSubscription(sub);
				}
			}
		},
	});

	plugin.addCommand({
		id: COMMAND_IDS.OPEN_CURRENT_NOTE_IN_CALENDAR,
		name: "Open current note in calendar",
		callback: async () => {
			await plugin.openCurrentNoteInCalendar();
		},
	});

	addMinimizedModalCommand(COMMAND_IDS.RESTORE_MINIMIZED_MODAL, "Restore minimized event modal", () => {
		MinimizedModalManager.restoreModal(plugin.app, plugin.calendarBundles);
	});

	addMinimizedModalCommand(
		COMMAND_IDS.ASSIGN_CATEGORIES_MINIMIZED_MODAL,
		"Assign categories to minimized event",
		() => {
			MinimizedModalManager.assignCategories(plugin.app, plugin.calendarBundles);
		}
	);

	plugin.addCommand({
		id: COMMAND_IDS.OPEN_AI_CHAT,
		name: "Open AI chat",
		callback: () => {
			void activateView(plugin.app.workspace, {
				viewType: AI_CHAT_VIEW_TYPE,
				placement: "right-sidebar",
				toggle: true,
			});
		},
	});
}
