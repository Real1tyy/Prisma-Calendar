import { BehaviorSubject } from "rxjs";
import { beforeEach, vi } from "vitest";
import type { CustomCalendarSettings, SingleCalendarConfig } from "../src/types/index";
import { MockFixtures } from "./fixtures/index";

// Mock problematic utils modules that depend on obsidian
vi.mock("@real1ty-obsidian-plugins/utils/templater-utils", () => ({
	createFromTemplate: vi.fn().mockResolvedValue("created content"),
	isTemplaterAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock("@real1ty-obsidian-plugins/utils/file-operations", () => ({
	duplicateFileWithNewZettelId: vi.fn().mockResolvedValue(undefined),
	withFile: vi.fn().mockImplementation((callback) => callback),
	withFileOperation: vi.fn().mockImplementation((callback) => callback),
}));

// Mock the common-plugin package that has missing files
vi.mock("@real1ty-obsidian-plugins/common-plugin", () => ({
	MountableView: (BaseClass: any) => {
		return class extends BaseClass {
			app: any;
			constructor(...args: any[]) {
				super(...args);
				this.app = args[0]?.app || { vault: {}, workspace: {}, metadataCache: {} };
			}
		};
	},
}));

// Mock async-utils that might be missing
vi.mock("@real1ty-obsidian-plugins/utils/async-utils", () => ({
	onceAsync: vi.fn().mockImplementation((fn) => fn),
}));

// Import local mocks
import {
	createMockApp,
	createMockFile,
	debounce,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	TFile,
} from "./mocks/obsidian";

export class Menu {
	addItem(callback: (item: any) => void) {
		const item = {
			setTitle: vi.fn().mockReturnThis(),
			setIcon: vi.fn().mockReturnThis(),
			onClick: vi.fn().mockReturnThis(),
		};
		callback(item);
		return this;
	}
	addSeparator() {
		return this;
	}
	showAtMouseEvent() {}
}

// Re-export centralized mocks for use in tests
export {
	Plugin,
	PluginSettingTab,
	ItemView,
	TFile,
	Notice,
	Modal,
	debounce,
	createMockApp,
	createMockFile,
};

/**
 * Enhanced test utilities using property-based testing and mocking
 */
export class TestUtils {
	/**
	 * Create a mock settings store with property-based or custom data
	 */
	static createMockSettingsStore(
		initialSettings?: Partial<CustomCalendarSettings>
	): BehaviorSubject<CustomCalendarSettings> {
		const settings = initialSettings
			? MockFixtures.customCalendarSettings(initialSettings)
			: MockFixtures.customCalendarSettings();
		return new BehaviorSubject<CustomCalendarSettings>(settings);
	}

	/**
	 * Create a mock single calendar config
	 */
	static createMockSingleCalendarSettings(
		overrides?: Partial<SingleCalendarConfig>
	): SingleCalendarConfig {
		return MockFixtures.singleCalendarConfig(overrides);
	}

	/**
	 * Create a mock settings store that returns single calendar settings (for legacy test compatibility)
	 */
	static createMockSingleCalendarSettingsStore(
		calendarOverrides?: Partial<SingleCalendarConfig>
	): BehaviorSubject<SingleCalendarConfig> {
		const settings = MockFixtures.singleCalendarConfig(calendarOverrides);
		return new BehaviorSubject(settings);
	}

	/**
	 * Create a mock Obsidian app with enhanced capabilities
	 */
	static createMockObsidianApp() {
		const mockVault = {
			on: vi.fn(),
			off: vi.fn(),
			getMarkdownFiles: vi.fn().mockReturnValue([]),
			getAbstractFileByPath: vi.fn(),
			create: vi.fn(),
			read: vi.fn(),
			modify: vi.fn(),
		};

		const mockMetadataCache = {
			getFileCache: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		};

		const mockFileManager = {
			processFrontMatter: vi.fn(),
		};

		const mockWorkspace = {
			openLinkText: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
		};

		return {
			vault: mockVault,
			metadataCache: mockMetadataCache,
			fileManager: mockFileManager,
			workspace: mockWorkspace,
		};
	}

	/**
	 * Create a mock TFile with realistic properties
	 */
	static createMockTFile(path: string, frontmatter?: Record<string, any>): any {
		const file = {
			path,
			extension: "md",
			parent: { path: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "" },
			stat: { mtime: Date.now() },
			basename: path.split("/").pop()?.replace(/\.md$/, "") || "untitled",
			name: path.split("/").pop() || "untitled.md",
		};

		// If frontmatter is provided, set up metadata cache mock
		if (frontmatter) {
			const mockApp = TestUtils.createMockObsidianApp();
			mockApp.metadataCache.getFileCache.mockReturnValue({
				frontmatter,
			});
		}

		return file;
	}

	/**
	 * Setup common test environment
	 */
	static setupTestEnvironment() {
		// Clear any existing DOM elements
		document.body.innerHTML = "";

		// Setup global test environment
		global.ResizeObserver = vi.fn().mockImplementation(() => ({
			observe: vi.fn(),
			unobserve: vi.fn(),
			disconnect: vi.fn(),
		}));

		// Mock window.getComputedStyle for FullCalendar
		Object.defineProperty(window, "getComputedStyle", {
			value: () => ({
				getPropertyValue: () => "",
			}),
		});

		return {
			cleanup: () => {
				vi.clearAllMocks();
				document.body.innerHTML = "";
			},
		};
	}

	/**
	 * Create a subscription tracker for testing RxJS subscriptions
	 */
	static createSubscriptionTracker() {
		const subscriptions: Array<{ unsubscribe: () => void }> = [];

		return {
			track: (subscription: { unsubscribe: () => void }) => {
				subscriptions.push(subscription);
				return subscription;
			},
			unsubscribeAll: () => {
				subscriptions.forEach((sub) => {
				sub.unsubscribe();
			});
				subscriptions.length = 0;
			},
			count: () => subscriptions.length,
		};
	}

	/**
	 * Wait for async operations to complete
	 */
	static async waitForAsync(ms: number = 0): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Create a mock event store with realistic behavior
	 */
	static createMockEventStore() {
		const events = new Map();
		const subscribers = new Set<(events: any[]) => void>();

		return {
			getEvents: vi.fn().mockImplementation(() => Array.from(events.values())),
			addEvent: vi.fn().mockImplementation((event) => {
				events.set(event.id, event);
				subscribers.forEach((callback) => {
				callback(Array.from(events.values()));
			});
			}),
			removeEvent: vi.fn().mockImplementation((id) => {
				events.delete(id);
				subscribers.forEach((callback) => {
				callback(Array.from(events.values()));
			});
			}),
			subscribe: vi.fn().mockImplementation((callback) => {
				subscribers.add(callback);
				return {
					unsubscribe: () => subscribers.delete(callback),
				};
			}),
			destroy: vi.fn().mockImplementation(() => {
				events.clear();
				subscribers.clear();
			}),
		};
	}
}

// Legacy compatibility exports
export const createMockSettingsStore = TestUtils.createMockSettingsStore;
export const createMockSingleCalendarSettings = TestUtils.createMockSingleCalendarSettings;
export const createMockSingleCalendarSettingsStore =
	TestUtils.createMockSingleCalendarSettingsStore;

// Setup DOM environment for FullCalendar tests
beforeEach(() => {
	TestUtils.setupTestEnvironment();
});
