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

import type { ObsidianWindow as BaseObsidianWindow } from "@real1ty-obsidian-plugins/testing/e2e";

export type { BaseObsidianWindow as ObsidianWindow };

export interface WorkspaceLeaf {
	setViewState: (state: unknown) => Promise<void>;
	detach: () => void;
}

export interface PrismaWindow extends Omit<BaseObsidianWindow, "app"> {
	app: Omit<BaseObsidianWindow["app"], "workspace" | "vault"> & {
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
		};
		vault: {
			adapter?: { basePath?: string };
			getMarkdownFiles: () => Array<{ path: string }>;
			create: (path: string, content: string) => Promise<unknown>;
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

export interface CalendarBundle {
	calendarId: string;
	viewType: string;
	initialize: () => Promise<void>;
	eventStore: { getAllEvents: () => EventRef[] };
	settingsStore: {
		currentSettings: Record<string, unknown>;
		updateSettings: (updater: (current: Record<string, unknown>) => Record<string, unknown>) => Promise<void>;
	};
	prerequisiteTracker: { isConnected: (filePath: string) => boolean };
	virtualEventStore: { add: (e: VirtualEventInput) => Promise<{ id: string }> };
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
	calendarBundles?: CalendarBundle[];
	ensureCalendarBundlesReady?: () => Promise<void>;
	licenseManager?: LicenseManager;
}
