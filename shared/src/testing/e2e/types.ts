// Shared renderer-side Obsidian shape used across every E2E helper that runs
// inside `page.evaluate(...)`. Obsidian doesn't ship type definitions for the
// internal `app.plugins` / `app.setting` / `app.commands` surfaces we rely on,
// so this interface is the single source of truth. Keep it minimal — add a
// field only when a helper actually needs it, and narrow with optionals where
// Obsidian versions diverge.

export type ObsidianPluginsRegistry = {
	setEnable?: (enable: boolean) => Promise<void> | void;
	enablePlugin?: (id: string) => Promise<void>;
	enablePluginAndSave?: (id: string) => Promise<void>;
	loadManifests?: () => Promise<void>;
	isEnabled?: () => boolean;
	plugins: Record<string, unknown>;
	manifests?: Record<string, unknown>;
};

export type ObsidianApp = {
	commands: {
		executeCommandById: (id: string) => boolean;
		commands?: Record<string, unknown>;
	};
	workspace: {
		openLinkText: (link: string, source: string, newLeaf?: boolean) => Promise<void>;
		layoutReady?: boolean;
		on?: (event: string, cb: () => void) => unknown;
		offref?: (ref: unknown) => void;
	};
	plugins: ObsidianPluginsRegistry;
	setting: {
		open: () => void;
		openTabById: (id: string) => void;
	};
	vault?: { adapter?: { basePath?: string } };
};

export type ObsidianWindow = {
	app: ObsidianApp;
};

// Usage inside `page.evaluate(...)`:
//
//   page.evaluate((arg) => {
//     const w = window as unknown as ObsidianWindow;
//     w.app.commands.executeCommandById(arg);
//   }, commandId);
//
// The type is imported at the *Node* side so TypeScript can check the body of
// the evaluate callback — the cast itself runs in the browser. You cannot
// import a helper function and call it inside evaluate: Playwright serializes
// the callback to source, so only values captured through the second argument
// make it into the page context.
