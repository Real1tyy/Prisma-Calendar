// Typed surfaces for Prisma's renderer-side runtime objects, used inside
// `page.evaluate(...)` callbacks. The base `ObsidianWindow` comes from the
// shared library; `PrismaWindow` extends it with the workspace + vault fields
// the calendar DSL touches, so consumers cast once instead of re-typing
// `getLeaf` / `getLeavesOfType` / `leftSplit` per evaluate call. The plugin
// entry is still cast to `PrismaPlugin` because `plugins.plugins` upstream is
// `Record<string, unknown>`.
//
// Usage inside an evaluate callback:
//
//   page.evaluate((pid) => {
//     const w = window as unknown as PrismaWindow;
//     const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
//     const bundle = plugin?.calendarBundles?.[0];
//     ...
//   }, PLUGIN_ID);
//
// Playwright serialises the callback source so the types live on the Node
// side only — they're erased at runtime.
//
// Maintenance contract: every renderer-side shape an e2e helper needs lives
// here. If a helper needs a new field, add it to the appropriate type below —
// do NOT re-declare a local `RendererWindow` / `SettingsStoreWindow` / etc.
// next to the evaluate call. A hookify rule enforces this on edit (see
// `.claude/hookify/rules/e2e-window-types.json`).

import type { ObsidianWindow as BaseObsidianWindow } from "@real1ty-obsidian-plugins/testing/e2e";

export type { BaseObsidianWindow as ObsidianWindow };

export interface WorkspaceLeaf {
	setViewState: (state: unknown) => Promise<void>;
	detach: () => void;
}

export interface PrismaWindow extends Omit<BaseObsidianWindow, "app"> {
	app: Omit<BaseObsidianWindow["app"], "workspace" | "vault" | "plugins"> & {
		workspace: Omit<BaseObsidianWindow["app"]["workspace"], "openLinkText"> & {
			openLinkText: (
				link: string,
				src: string,
				newLeaf?: boolean,
				state?: { state?: { mode?: string } }
			) => Promise<void>;
			getLeaf: (newLeaf: boolean | "tab" | "split") => WorkspaceLeaf;
			getLeavesOfType: (type: string) => WorkspaceLeaf[];
			getActiveFile: () => { path: string } | null;
			leftSplit?: { collapse: () => void; collapsed?: boolean };
			onLayoutReady: (cb: () => void) => void;
			// Obsidian `Debouncer`'s `.run()` — flushes any pending workspace-layout
			// save synchronously. Needed before reloads so leaves persist to
			// `workspace.json` instead of being lost to the debounce window.
			requestSaveLayout: { run: () => Promise<void> };
		};
		vault: {
			adapter?: {
				basePath?: string;
				exists: (path: string) => Promise<boolean>;
			};
			getMarkdownFiles: () => Array<{ path: string }>;
			getFiles: () => Array<{ path: string }>;
			getAbstractFileByPath: (path: string) => unknown;
			create: (path: string, content: string) => Promise<unknown>;
			createFolder: (path: string) => Promise<void>;
			read: (file: unknown) => Promise<string>;
			modify: (file: unknown, content: string) => Promise<void>;
		};
		plugins: BaseObsidianWindow["app"]["plugins"] & {
			disablePlugin?: (id: string) => Promise<void>;
			disablePluginAndSave?: (id: string) => Promise<void>;
		};
		commands: Omit<BaseObsidianWindow["app"]["commands"], "commands"> & {
			commands: Record<string, { name: string } | undefined>;
		};
		metadataCache: {
			getFileCache: (file: { path: string }) => { frontmatter?: Record<string, unknown> } | null;
		};
		fileManager: {
			processFrontMatter: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>;
		};
		secretStorage: {
			getSecret: (name: string) => unknown;
		};
	};
}

export interface EventRef {
	title: string;
	ref: { filePath: string };
}

export interface VirtualEventInput {
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	properties: Record<string, unknown>;
}

export interface PluginSettingsStore {
	currentSettings?: Record<string, unknown>;
	updateSettings?: (updater: (current: Record<string, unknown>) => Record<string, unknown>) => Promise<void>;
}

export interface CalendarBundle {
	calendarId: string;
	viewType: string;
	initialize: () => Promise<void>;
	activateCalendarView?: () => Promise<void>;
	eventStore: { getAllEvents: () => EventRef[] };
	settingsStore: {
		currentSettings: Record<string, unknown>;
		updateSettings: (updater: (current: Record<string, unknown>) => Record<string, unknown>) => Promise<void>;
	};
	prerequisiteTracker: { isConnected: (filePath: string) => boolean };
	virtualEventStore: {
		add: (e: VirtualEventInput) => Promise<{ id: string }>;
		getAll: () => Array<{ id: string; title: string; start: string; end: string | null }>;
	};
	viewRef?: {
		calendarComponent?: {
			calendar?: {
				gotoDate: (d: string) => void;
				getDate?: () => Date;
			};
		} | null;
	};
}

export interface LicenseStatusPayload {
	state: string;
	activationsCurrent: number;
	activationsLimit: number;
	expiresAt: string | null;
	errorMessage: string | null;
}

export interface LicenseManager {
	status$: { next: (v: LicenseStatusPayload) => void };
	__setProForTesting?: (v: boolean) => void;
}

export interface PrismaPlugin {
	manifest?: { version?: string };
	calendarBundles?: CalendarBundle[];
	ensureCalendarBundlesReady?: () => Promise<void>;
	refreshCalendarBundles?: () => Promise<void>;
	addCalendarBundle?: (calendarId: string) => Promise<void>;
	settingsStore?: PluginSettingsStore;
	licenseManager?: LicenseManager;
	lastUsedCalendarId?: string | null;
}
