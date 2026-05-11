import { AppContext } from "@real1ty-obsidian-plugins-react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { App } from "obsidian";
import { createElement, type ReactElement, type ReactNode } from "react";
import { BehaviorSubject, Subject } from "rxjs";
import { vi } from "vitest";

import type { CalendarBundle } from "../../src/core/calendar-bundle";
import { BundleContext } from "../../src/react/contexts/bundle-context";
import { PluginContext } from "../../src/react/contexts/plugin-context";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createMockCalendarSettingsStore } from "./settings-fixtures";

export function createMockReactBundle(
	overrides: {
		settings?: Partial<SingleCalendarConfig>;
		isPro?: boolean;
	} = {}
): CalendarBundle {
	const settingsStore = createMockCalendarSettingsStore(overrides.settings ?? {});
	const eventStoreChanges$ = new Subject<void>();
	const recurringChanges$ = new Subject<void>();
	const prereqGraph$ = new Subject<void>();
	const categoriesSubject = new BehaviorSubject<string[]>([]);
	const isPro$ = new BehaviorSubject<boolean>(overrides.isPro ?? true);

	return {
		settingsStore,
		eventStore: {
			changes$: eventStoreChanges$.asObservable(),
			getAllEvents: vi.fn().mockReturnValue([]),
			getEvents: vi.fn().mockResolvedValue([]),
			_changes$: eventStoreChanges$,
		},
		recurringEventManager: {
			changes$: recurringChanges$.asObservable(),
			getAllRecurringEvents: vi.fn().mockReturnValue([]),
			getInstanceCountByRRuleId: vi.fn().mockReturnValue(0),
			_changes$: recurringChanges$,
		},
		categoryTracker: {
			categories$: categoriesSubject.asObservable(),
			getCategories: vi.fn().mockReturnValue([]),
			getCategoryStats: vi.fn().mockReturnValue({ total: 0, timed: 0, allDay: 0 }),
			getCategoryColor: vi.fn().mockReturnValue(undefined),
		},
		nameSeriesTracker: {
			getNameBasedSeries: vi.fn().mockReturnValue(new Map()),
		},
		untrackedEventStore: {
			getUntrackedEvents: vi.fn().mockReturnValue([]),
			subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
		},
		commandManager: {
			executeCommand: vi.fn().mockResolvedValue(undefined),
		},
		prerequisiteTracker: {
			graph$: prereqGraph$.asObservable(),
			getPrerequisitesOf: vi.fn().mockReturnValue([]),
			getGraph: vi.fn().mockReturnValue({ nodes: new Map(), edges: [] }),
		},
		plugin: {
			licenseManager: {
				isPro$,
				get isPro() {
					return isPro$.value;
				},
			},
			settings: settingsStore.currentSettings,
		},
	} as unknown as CalendarBundle;
}

export function createMockApp(): App {
	return {
		workspace: { openLinkText: vi.fn() },
		vault: {},
		metadataCache: {},
		commands: { executeCommandById: vi.fn() },
	} as unknown as App;
}

export function createMockPlugin(bundle: CalendarBundle): any {
	return {
		calendarBundles: [bundle],
		licenseManager: (bundle as any).plugin?.licenseManager,
	};
}

interface RenderWithContextsOptions extends Omit<RenderOptions, "wrapper"> {
	bundle?: CalendarBundle;
	app?: App;
	plugin?: any;
}

export function renderWithContexts(
	ui: ReactElement,
	{ bundle, app, plugin, ...options }: RenderWithContextsOptions = {}
): RenderResult & { bundle: CalendarBundle; app: App; plugin: any } {
	const resolvedBundle = bundle ?? createMockReactBundle();
	const resolvedApp = app ?? createMockApp();
	const resolvedPlugin = plugin ?? createMockPlugin(resolvedBundle);

	function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			AppContext,
			{ value: resolvedApp },
			createElement(
				PluginContext,
				{ value: resolvedPlugin },
				createElement(BundleContext, { value: resolvedBundle }, children)
			)
		);
	}

	const result = render(ui, { wrapper: Wrapper, ...options });
	return { ...result, bundle: resolvedBundle, app: resolvedApp, plugin: resolvedPlugin };
}
