import { vi } from "vitest";
import type { Frontmatter } from "../../src/types";

// Base Plugin class mock
export class Plugin {
	app: any;
	manifest: any;
	settings: any;

	constructor(app: any, manifest: any) {
		this.app = app;
		this.manifest = manifest;
	}

	// Core plugin methods
	addSettingTab = vi.fn();
	registerEvent = vi.fn();
	loadData = vi.fn().mockResolvedValue({});
	saveData = vi.fn().mockResolvedValue(undefined);
	onload = vi.fn();
	onunload = vi.fn();

	// UI methods
	addRibbonIcon = vi.fn();
	addStatusBarItem = vi.fn();
	addCommand = vi.fn();
	removeCommand = vi.fn();

	// Event methods
	registerDomEvent = vi.fn();
	registerCodeMirror = vi.fn();
	registerEditorExtension = vi.fn();
	registerMarkdownPostProcessor = vi.fn();
	registerMarkdownCodeBlockProcessor = vi.fn();
	registerObsidianProtocolHandler = vi.fn();
	registerEditorSuggest = vi.fn();
	registerHoverLinkSource = vi.fn();

	// Interval methods
	registerInterval = vi.fn();

	// View and extension methods
	registerView = vi.fn();
	registerExtensions = vi.fn();

	// Lifecycle methods
	onUserEnable = vi.fn();
	load = vi.fn();
	unload = vi.fn();

	// Other methods
	addChild = vi.fn();
	removeChild = vi.fn();
	register = vi.fn();
}

// PluginSettingTab mock
export class PluginSettingTab {
	app: any;
	plugin: any;
	containerEl: HTMLElement;

	constructor(app: any, plugin: any) {
		this.app = app;
		this.plugin = plugin;
		this.containerEl = document.createElement("div");
	}

	display = vi.fn();
}

// ItemView mock
export class ItemView {
	app: any;
	leaf: any;
	containerEl: HTMLElement;

	constructor(leaf: any) {
		this.leaf = leaf;
		this.app = leaf?.app;
		this.containerEl = document.createElement("div");
	}

	// Don't override onOpen/onClose - let subclasses implement them
	// These methods are implemented by MountableView mixin

	// Don't provide default implementations for these methods
	// Let subclasses implement them
	getViewType(): string {
		return "mock-view";
	}

	getDisplayText(): string {
		return "Mock View";
	}

	getIcon(): string {
		return "mock-icon";
	}

	getState = vi.fn().mockReturnValue({});
	setState = vi.fn().mockResolvedValue(undefined);
}

// Setting component mock
export class Setting {
	settingEl: HTMLElement;
	nameEl: HTMLElement;
	descEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(_containerEl: HTMLElement) {
		this.settingEl = document.createElement("div");
		this.nameEl = document.createElement("div");
		this.descEl = document.createElement("div");
		this.controlEl = document.createElement("div");
	}

	setName = vi.fn().mockReturnThis();
	setDesc = vi.fn().mockReturnThis();
	addText = vi.fn().mockReturnThis();
	addTextArea = vi.fn().mockReturnThis();
}

// TFolder mock
export class TFolder {
	path: string;
	name: string;
	children: any[];
	vault: any;
	parent: TFolder | null;

	constructor(path: string) {
		this.path = path;
		this.name = path.split("/").pop() || "";
		this.children = [];
		this.vault = {};
		this.parent = null;
	}

	isRoot(): boolean {
		return this.path === "" || this.path === "/";
	}
}

// TFile mock with full interface
export class TFile {
	path: string;
	name: string;
	basename: string;
	extension: string;
	stat: any;
	vault: any;
	parent: TFolder | null;

	constructor(path: string, parentPath?: string) {
		this.path = path;
		this.name = path.split("/").pop() || "";
		this.basename = this.name.replace(/\.[^/.]+$/, ""); // Remove extension
		this.extension = path.split(".").pop() || "md";
		this.stat = {};
		this.vault = {};

		// Set parent based on path or explicit parentPath
		if (parentPath !== undefined) {
			this.parent = parentPath ? new TFolder(parentPath) : null;
		} else {
			// Derive parent from path
			const lastSlash = path.lastIndexOf("/");
			if (lastSlash > 0) {
				this.parent = new TFolder(path.substring(0, lastSlash));
			} else {
				this.parent = null;
			}
		}
	}
}

// Modal mock
export class Modal {
	app: any;
	containerEl: HTMLElement;
	titleEl: HTMLElement;
	contentEl: HTMLElement;

	constructor(app: any) {
		this.app = app;
		this.containerEl = document.createElement("div");
		this.titleEl = document.createElement("div");
		this.contentEl = document.createElement("div");
	}

	open = vi.fn();
	close = vi.fn();
	onOpen = vi.fn();
	onClose = vi.fn();
}

// Notice mock
export class Notice {
	constructor(message: string) {
		console.log(`Notice: ${message}`);
	}
}

// MarkdownRenderer mock
export const MarkdownRenderer = {
	render: vi.fn().mockResolvedValue(undefined),
};

// Debounce function mock
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number, immediate?: boolean): T {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return ((...args: Parameters<T>) => {
		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};

		const callNow = immediate && !timeout;

		if (timeout !== null) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) func(...args);
	}) as T;
}

// App mock
export const App = vi.fn();

// Mock interfaces for TypeScript
export interface MockApp {
	fileManager: {
		processFrontMatter: ReturnType<typeof vi.fn>;
		renameFile: ReturnType<typeof vi.fn>;
	};
	metadataCache: {
		getFileCache: ReturnType<typeof vi.fn>;
	};
	vault: {
		getAbstractFileByPath: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		read: ReturnType<typeof vi.fn>;
		cachedRead: ReturnType<typeof vi.fn>;
		modify: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		rename: ReturnType<typeof vi.fn>;
		getFiles: ReturnType<typeof vi.fn>;
		getMarkdownFiles: ReturnType<typeof vi.fn>;
		getFolderByPath: ReturnType<typeof vi.fn>;
	};
	workspace: {
		getActiveFile: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
	};
}

// Helper function to create a fully mocked app
export function createMockApp(): MockApp {
	return {
		fileManager: {
			processFrontMatter: vi.fn(),
			renameFile: vi.fn().mockResolvedValue(undefined),
		},
		metadataCache: {
			getFileCache: vi.fn(),
		},
		vault: {
			getAbstractFileByPath: vi.fn(),
			on: vi.fn(),
			read: vi.fn(),
			cachedRead: vi.fn(),
			modify: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
			rename: vi.fn(),
			getFiles: vi.fn().mockReturnValue([]),
			getMarkdownFiles: vi.fn().mockReturnValue([]),
			getFolderByPath: vi.fn(),
		},
		workspace: {
			getActiveFile: vi.fn(),
			on: vi.fn(),
		},
	};
}

// Helper to create mock TFile instances
export function createMockFile(
	path: string,
	options?: {
		basename?: string;
		parentPath?: string;
		extension?: string;
	}
): TFile {
	const file = new TFile(path, options?.parentPath);
	if (options?.basename) {
		file.basename = options.basename;
	}
	if (options?.extension) {
		file.extension = options.extension;
	}
	return file;
}

// Helper to create mock file cache
export function createMockFileCache(frontmatter?: Frontmatter) {
	return {
		frontmatter: frontmatter || {},
		frontmatterPosition: frontmatter ? { start: { line: 0 }, end: { line: 3 } } : null,
		sections: [],
		headings: [],
		links: [],
		embeds: [],
		tags: [],
		listItems: [],
	};
}
