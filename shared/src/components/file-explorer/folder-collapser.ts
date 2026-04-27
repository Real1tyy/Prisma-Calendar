import { type App, Keymap, type Plugin, TFile, TFolder } from "obsidian";

/**
 * Configuration for the FolderCollapser.
 */
export interface FolderCollapserConfig {
	/**
	 * CSS prefix for scoping all class names to this plugin's namespace.
	 * Uses the same convention as `createCssUtils(prefix)` — e.g. `"prisma-"`, `"nexus-"`.
	 *
	 * All generated CSS classes will be prefixed:
	 * - `${prefix}folder-collapser-active` (body toggle)
	 * - `${prefix}collapsed-child` (hidden children)
	 * - `${prefix}has-collapsed-children` (folder marker)
	 * - `${prefix}all-children-collapsed` (empty folder marker)
	 */
	cssPrefix: string;

	/**
	 * Given a folder path, return the primary TFile that should be opened
	 * when the user clicks the folder, or null if this folder should NOT be collapsed.
	 *
	 * This is the core resolution function — it determines which folders are managed
	 * and what file each folder "represents".
	 *
	 * @example
	 * resolvePrimaryFile: (folderPath) => {
	 *   const folder = app.vault.getAbstractFileByPath(folderPath);
	 *   if (!(folder instanceof TFolder)) return null;
	 *   const notePath = `${folderPath}/${folder.name}.md`;
	 *   const file = app.vault.getAbstractFileByPath(notePath);
	 *   return file instanceof TFile ? file : null;
	 * }
	 */
	resolvePrimaryFile: (folderPath: string) => TFile | null;

	/**
	 * Whether to patch Obsidian's `revealInFolder` so that revealing a hidden
	 * child file reveals the parent folder instead. Default: true.
	 */
	patchRevealInFolder?: boolean;

	/**
	 * Whether to open the primary file in a new tab when clicking without
	 * modifier keys. Default: false (uses active tab).
	 */
	openInNewTab?: boolean;
}

/** Unprefixed CSS class suffixes — combined with `cssPrefix` at runtime. */
const CLASS_SUFFIXES = {
	BODY_ACTIVE: "folder-collapser-active",
	COLLAPSED_CHILD: "collapsed-child",
	HAS_COLLAPSED: "has-collapsed-children",
	ALL_COLLAPSED: "all-children-collapsed",
} as const;

interface PrefixedClasses {
	bodyActive: string;
	collapsedChild: string;
	hasCollapsed: string;
	allCollapsed: string;
}

function buildPrefixedClasses(prefix: string): PrefixedClasses {
	return {
		bodyActive: `${prefix}${CLASS_SUFFIXES.BODY_ACTIVE}`,
		collapsedChild: `${prefix}${CLASS_SUFFIXES.COLLAPSED_CHILD}`,
		hasCollapsed: `${prefix}${CLASS_SUFFIXES.HAS_COLLAPSED}`,
		allCollapsed: `${prefix}${CLASS_SUFFIXES.ALL_COLLAPSED}`,
	};
}

function buildStyleRules(cls: PrefixedClasses): string {
	return `
.${cls.bodyActive} .${cls.collapsedChild} {
	display: none !important;
}
.${cls.bodyActive} .${cls.allCollapsed} > .nav-folder-children {
	display: none !important;
}
.${cls.hasCollapsed} > .nav-folder-title > .nav-folder-title-content:hover {
	cursor: pointer !important;
}
`;
}

interface FileExplorerItem {
	selfEl?: HTMLElement;
	titleEl?: HTMLElement;
}

interface FileExplorerView {
	fileItems: Record<string, FileExplorerItem>;
}

/**
 * Collapses folders in Obsidian's file explorer so they appear as single nodes.
 *
 * When a folder is collapsed, all its children are hidden via CSS and clicking the folder
 * opens the primary file (resolved by the config callback) instead of expanding the folder.
 *
 * All CSS classes are namespaced under the provided `cssPrefix`, so multiple plugins
 * can use FolderCollapser independently without class conflicts.
 *
 * @example
 * ```typescript
 * const collapser = new FolderCollapser(this, {
 *   cssPrefix: "my-plugin-",
 *   resolvePrimaryFile: (folderPath) => {
 *     const folder = this.app.vault.getAbstractFileByPath(folderPath);
 *     if (!(folder instanceof TFolder)) return null;
 *     const notePath = `${folderPath}/${folder.name}.md`;
 *     const file = this.app.vault.getAbstractFileByPath(notePath);
 *     return file instanceof TFile ? file : null;
 *   },
 * });
 *
 * this.app.workspace.onLayoutReady(() => collapser.initialize());
 * this.register(() => collapser.destroy());
 * ```
 */
export class FolderCollapser {
	private plugin: Plugin;
	private app: App;
	private config: Required<FolderCollapserConfig>;
	private cls: PrefixedClasses;
	private observer: MutationObserver | null = null;
	private styleEl: HTMLStyleElement | null = null;
	private originalRevealInFolder: ((file: unknown) => void) | null = null;
	private initialized = false;

	constructor(plugin: Plugin, config: FolderCollapserConfig) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.config = {
			patchRevealInFolder: true,
			openInNewTab: false,
			...config,
		};
		this.cls = buildPrefixedClasses(config.cssPrefix);
	}

	/**
	 * Initialize the folder collapser. Call this from `workspace.onLayoutReady()`.
	 * Sets up CSS injection, click interception, MutationObserver, vault events,
	 * and optionally patches `revealInFolder`.
	 */
	initialize(): void {
		if (this.initialized) return;
		this.initialized = true;

		this.injectStyles();
		document.body.classList.add(this.cls.bodyActive);

		this.applyToAllFolders();
		this.startObserving();
		this.registerClickHandler();
		this.registerVaultEvents();

		if (this.config.patchRevealInFolder) {
			this.patchRevealInFolder();
		}
	}

	/**
	 * Re-evaluate a specific folder's collapse state.
	 * Call this when you know a folder's content has changed.
	 */
	updateFolder(folderPath: string): void {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return;

		const primaryFile = this.config.resolvePrimaryFile(folderPath);

		if (!primaryFile) {
			this.removeClassesFromFolder(folder);
			return;
		}

		this.applyClassesToFolder(folder, primaryFile);
	}

	/**
	 * Re-evaluate all folders in the vault.
	 * Useful after bulk operations or settings changes.
	 */
	refreshAll(): void {
		this.applyToAllFolders();
	}

	/**
	 * Clean up all resources. Call from `plugin.register()` or `onunload()`.
	 */
	destroy(): void {
		if (!this.initialized) return;
		this.initialized = false;

		this.observer?.disconnect();
		this.observer = null;

		this.styleEl?.remove();
		this.styleEl = null;

		document.body.classList.remove(this.cls.bodyActive);

		this.restoreRevealInFolder();
		this.removeAllClasses();
	}

	// ─── CSS Injection ───────────────────────────────────────────────────

	private injectStyles(): void {
		// eslint-disable-next-line obsidianmd/no-forbidden-elements -- runtime style injection
		this.styleEl = document.createElement("style");
		this.styleEl.id = `${this.config.cssPrefix}folder-collapser-styles`;
		this.styleEl.textContent = buildStyleRules(this.cls);
		document.head.appendChild(this.styleEl);
	}

	// ─── Class Application ───────────────────────────────────────────────

	private getFileExplorerView(): FileExplorerView | null {
		const leaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- array may be empty at runtime (noUncheckedIndexedAccess disabled)
		if (!leaf) return null;
		return leaf.view as unknown as FileExplorerView;
	}

	private getExplorerElement(path: string): HTMLElement | null {
		const view = this.getFileExplorerView();
		if (!view) return null;
		const item = view.fileItems[path];
		return item.selfEl ?? item.titleEl ?? null;
	}

	private applyClassesToFolder(folder: TFolder, primaryFile: TFile): void {
		const primaryEl = this.getExplorerElement(primaryFile.path);
		if (primaryEl) {
			primaryEl.classList.add(this.cls.collapsedChild);
		}

		const folderEl = this.getExplorerElement(folder.path);
		if (folderEl) {
			folderEl.classList.add(this.cls.hasCollapsed);
		}

		for (const child of folder.children) {
			if (child.path === primaryFile.path) continue;

			const childEl = this.getExplorerElement(child.path);
			if (childEl) {
				childEl.classList.add(this.cls.collapsedChild);
			}
		}

		if (this.hasOnlyCollapsedChildren(folder, primaryFile)) {
			const folderParentEl = this.getExplorerElement(folder.path);
			if (folderParentEl) {
				const navFolder = folderParentEl.closest(".nav-folder");
				if (navFolder) {
					navFolder.classList.add(this.cls.allCollapsed);
				}
			}
		}
	}

	private hasOnlyCollapsedChildren(folder: TFolder, primaryFile: TFile): boolean {
		return folder.children.every((child) => child.path === primaryFile.path || child instanceof TFolder);
	}

	private removeClassesFromFolder(folder: TFolder): void {
		const folderEl = this.getExplorerElement(folder.path);
		if (folderEl) {
			folderEl.classList.remove(this.cls.hasCollapsed);
			const navFolder = folderEl.closest(".nav-folder");
			if (navFolder) {
				navFolder.classList.remove(this.cls.allCollapsed);
			}
		}

		for (const child of folder.children) {
			const childEl = this.getExplorerElement(child.path);
			if (childEl) {
				childEl.classList.remove(this.cls.collapsedChild);
			}
		}
	}

	private applyToAllFolders(): void {
		const rootFolder = this.app.vault.getRoot();
		this.applyRecursive(rootFolder);
	}

	private applyRecursive(folder: TFolder): void {
		const primaryFile = this.config.resolvePrimaryFile(folder.path);
		if (primaryFile) {
			this.applyClassesToFolder(folder, primaryFile);
		}

		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.applyRecursive(child);
			}
		}
	}

	private removeAllClasses(): void {
		const view = this.getFileExplorerView();
		if (!view) return;

		for (const item of Object.values(view.fileItems)) {
			const el = item.selfEl ?? item.titleEl;
			if (el) {
				el.classList.remove(this.cls.collapsedChild, this.cls.hasCollapsed);
				const navFolder = el.closest(".nav-folder");
				if (navFolder) {
					navFolder.classList.remove(this.cls.allCollapsed);
				}
			}
		}
	}

	// ─── Click Interception ──────────────────────────────────────────────

	private registerClickHandler(): void {
		const handler = (evt: MouseEvent) => this.handleClick(evt);

		this.plugin.registerDomEvent(document, "click", handler, true);
		this.plugin.registerDomEvent(
			document,
			"auxclick",
			(evt: MouseEvent) => {
				if (evt.button === 2) return;
				this.handleClick(evt);
			},
			true
		);
	}

	private handleClick(evt: MouseEvent): void {
		if (evt.shiftKey) return;

		const target = evt.target as HTMLElement;
		const folderTitleEl = target.closest<HTMLElement>(".nav-folder-title");
		if (!folderTitleEl) return;

		if (target.closest(".collapse-icon")) return;

		const folderPath = folderTitleEl.getAttribute("data-path");
		if (!folderPath) return;

		const primaryFile = this.config.resolvePrimaryFile(folderPath);
		if (!(primaryFile instanceof TFile)) return;

		evt.preventDefault();
		evt.stopImmediatePropagation();

		this.openFile(primaryFile, evt);
	}

	private openFile(file: TFile, evt: MouseEvent): void {
		const newTab = Keymap.isModEvent(evt) || this.config.openInNewTab;
		const leaf = this.app.workspace.getLeaf(newTab);
		void leaf.openFile(file);
	}

	// ─── MutationObserver ────────────────────────────────────────────────

	private startObserving(): void {
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (!(node instanceof HTMLElement)) continue;
					this.processAddedNode(node);
				}
			}
		});

		this.observer.observe(document.body, { childList: true, subtree: true });
	}

	private processAddedNode(node: HTMLElement): void {
		const titleEls = node.querySelectorAll<HTMLElement>(".nav-folder-title-content");
		if (node.classList.contains("nav-folder-title-content")) {
			this.handleNewFolderTitle(node);
		}
		for (const el of Array.from(titleEls)) {
			this.handleNewFolderTitle(el);
		}
	}

	private handleNewFolderTitle(titleContentEl: HTMLElement): void {
		const titleEl = titleContentEl.closest<HTMLElement>(".nav-folder-title");
		if (!titleEl) return;

		const folderPath = titleEl.getAttribute("data-path");
		if (!folderPath) return;

		this.updateFolder(folderPath);
	}

	// ─── Vault Events ────────────────────────────────────────────────────

	private registerVaultEvents(): void {
		this.plugin.registerEvent(
			this.app.vault.on("create", (file) => {
				this.handleFileChange(file.path);
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				this.handleFileChange(file.path);
				this.handleFileChange(this.getParentPath(oldPath));
			})
		);

		this.plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.handleFileChange(this.getParentPath(file.path));
			})
		);
	}

	private handleFileChange(path: string): void {
		const parentPath = this.getParentPath(path);
		if (parentPath) {
			this.updateFolder(parentPath);
		}
		this.updateFolder(path);
	}

	private getParentPath(path: string): string {
		const lastSlash = path.lastIndexOf("/");
		return lastSlash === -1 ? "" : path.substring(0, lastSlash);
	}

	// ─── RevealInFolder Patch ────────────────────────────────────────────

	private patchRevealInFolder(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing internal Obsidian API
		const internalPlugins = (this.app as any).internalPlugins;
		const fileExplorerPlugin = internalPlugins?.getEnabledPluginById?.("file-explorer");
		if (!fileExplorerPlugin?.revealInFolder) return;

		this.originalRevealInFolder = fileExplorerPlugin.revealInFolder.bind(fileExplorerPlugin);

		fileExplorerPlugin.revealInFolder = (file: unknown) => {
			if (file instanceof TFile) {
				const parentPath = this.getParentPath(file.path);
				const primaryFile = this.config.resolvePrimaryFile(parentPath);
				if (primaryFile && primaryFile.path === file.path) {
					const folder = this.app.vault.getAbstractFileByPath(parentPath);
					if (folder) {
						document.body.classList.remove(this.cls.bodyActive);
						this.originalRevealInFolder!.call(fileExplorerPlugin, folder);
						setTimeout(() => {
							document.body.classList.add(this.cls.bodyActive);
						}, 100);
						return;
					}
				}
			}
			this.originalRevealInFolder!.call(fileExplorerPlugin, file);
		};
	}

	private restoreRevealInFolder(): void {
		if (!this.originalRevealInFolder) return;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing internal Obsidian API
		const internalPlugins = (this.app as any).internalPlugins;
		const fileExplorerPlugin = internalPlugins?.getEnabledPluginById?.("file-explorer");
		if (fileExplorerPlugin) {
			fileExplorerPlugin.revealInFolder = this.originalRevealInFolder;
		}
		this.originalRevealInFolder = null;
	}
}
