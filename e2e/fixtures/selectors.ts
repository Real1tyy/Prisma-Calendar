// Centralised locators. React migration will churn the DOM; keeping every
// selector in one file limits the blast radius of those churns.
//
// Prefer role-based selectors where possible. Fall back to Obsidian's own
// class names (workspace-*, modal-*, setting-*) — they're stable across plugin
// versions.

export const SELECTORS = {
	workspace: ".workspace",
	workspaceLeaf: ".workspace-leaf",

	commandPalette: {
		prompt: ".prompt",
		input: ".prompt-input",
		suggestions: ".suggestion-item",
	},

	settings: {
		modal: ".modal-container .mod-settings",
		sidebarTab: ".vertical-tab-header-group .vertical-tab-nav-item",
		prismaTabName: "Prisma Calendar",
		content: ".vertical-tab-content",
		heading: ".setting-item-heading",
		toggle: ".checkbox-container",
	},

	modal: {
		root: ".modal",
		title: ".modal-title",
		closeButton: ".modal-close-button",
	},

	notice: ".notice",
} as const;

export const PRISMA_COMMANDS = {
	createEvent: "Prisma Calendar: Create event",
	openCalendar: "Prisma Calendar: Open calendar",
} as const;
