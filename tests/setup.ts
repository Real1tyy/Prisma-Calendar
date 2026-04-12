import { BehaviorSubject } from "rxjs";
import { beforeEach, vi } from "vitest";

import type { CustomCalendarSettings } from "../src/types/index";
import { CustomCalendarSettingsSchema } from "../src/types/index";

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
	createMockApp as createMockAppImpl,
	createMockFile as createMockFileImpl,
	debounce,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	SuggestModal,
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
export { debounce, ItemView, Modal, Notice, Plugin, PluginSettingTab, SuggestModal, TFile };

// Export mock helpers directly
export const createMockApp = createMockAppImpl;
export const createMockFile = createMockFileImpl;

export function createMockSettingsStore(
	initialSettings?: Partial<CustomCalendarSettings>
): BehaviorSubject<CustomCalendarSettings> {
	const defaultSettings = CustomCalendarSettingsSchema.parse({});
	const settings = { ...defaultSettings, ...initialSettings };
	return new BehaviorSubject<CustomCalendarSettings>(settings);
}

// Create a mock single calendar config for testing individual calendar settings
export function createMockSingleCalendarSettings() {
	const fullSettings = CustomCalendarSettingsSchema.parse({});
	return fullSettings.calendars[0]; // Return the default calendar
}

// Create a mock settings store that returns single calendar settings (for legacy test compatibility)
export function createMockSingleCalendarSettingsStore(calendarOverrides?: any): BehaviorSubject<any> {
	const singleCalendarSettings = createMockSingleCalendarSettings();
	const settings = { ...singleCalendarSettings, ...calendarOverrides };
	return new BehaviorSubject(settings);
}

// Polyfill Obsidian's DOM augmentations for test environment
function polyfillObsidianDOM(): void {
	const proto = HTMLElement.prototype as any;
	if (proto.createDiv) return;

	type ElOptions = {
		text?: string;
		cls?: string | string[];
		attr?: Record<string, string>;
		type?: string;
		value?: string;
		placeholder?: string;
		href?: string;
	};

	function applyClass(el: HTMLElement, cls: string | string[] | undefined): void {
		if (!cls) return;
		el.className = Array.isArray(cls) ? cls.join(" ") : cls;
	}

	function applyOptions(el: HTMLElement, options?: ElOptions): void {
		if (!options) return;
		if (options.text !== undefined) el.textContent = options.text;
		applyClass(el, options.cls);
		if (options.attr) {
			for (const [k, v] of Object.entries(options.attr)) {
				el.setAttribute(k, v);
			}
		}
		if (options.type !== undefined) el.setAttribute("type", options.type);
		if (options.value !== undefined) (el as HTMLInputElement).value = options.value;
		if (options.placeholder !== undefined) el.setAttribute("placeholder", options.placeholder);
		if (options.href !== undefined) el.setAttribute("href", options.href);
	}

	proto.empty = function (this: HTMLElement) {
		this.innerHTML = "";
	};

	proto.setText = function (this: HTMLElement, text: string) {
		this.textContent = text;
	};

	proto.setAttr = function (this: HTMLElement, name: string, value: string) {
		this.setAttribute(name, value);
	};

	proto.addClass = function (this: HTMLElement, ...classes: string[]) {
		this.classList.add(...classes);
	};

	proto.removeClass = function (this: HTMLElement, ...classes: string[]) {
		this.classList.remove(...classes);
	};

	proto.toggleClass = function (this: HTMLElement, cls: string, force?: boolean) {
		this.classList.toggle(cls, force);
	};

	function createAndAppend(parent: HTMLElement, tag: string, arg?: string | ElOptions): HTMLElement {
		const el = document.createElement(tag);
		if (typeof arg === "string") {
			el.className = arg;
		} else if (arg) {
			applyOptions(el, arg);
		}
		parent.appendChild(el);
		return el;
	}

	proto.createDiv = function (this: HTMLElement, arg?: string | ElOptions) {
		return createAndAppend(this, "div", arg);
	};

	proto.createSpan = function (this: HTMLElement, arg?: string | ElOptions) {
		return createAndAppend(this, "span", arg);
	};

	proto.createEl = function (this: HTMLElement, tag: string, options?: ElOptions) {
		return createAndAppend(this, tag, options);
	};

	(globalThis as any).createDiv = function (arg?: string | ElOptions) {
		const div = document.createElement("div");
		if (typeof arg === "string") div.className = arg;
		else if (arg) applyOptions(div, arg);
		return div;
	};
}

polyfillObsidianDOM();

// Setup DOM environment for FullCalendar tests
beforeEach(() => {
	document.body.replaceChildren();

	// Add any global test setup here
});
