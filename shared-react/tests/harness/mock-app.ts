import type { App } from "obsidian";
import { vi } from "vitest";

export interface MockApp extends App {
	vault: {
		getAbstractFileByPath: ReturnType<typeof vi.fn>;
		read: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		modify: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
		adapter: {
			exists: ReturnType<typeof vi.fn>;
			read: ReturnType<typeof vi.fn>;
			write: ReturnType<typeof vi.fn>;
		};
		getRoot: ReturnType<typeof vi.fn>;
		getName: ReturnType<typeof vi.fn>;
	};
	workspace: {
		getLeaf: ReturnType<typeof vi.fn>;
		getLeavesOfType: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		off: ReturnType<typeof vi.fn>;
		trigger: ReturnType<typeof vi.fn>;
		activeLeaf: null;
	};
	metadataCache: {
		getFileCache: ReturnType<typeof vi.fn>;
		on: ReturnType<typeof vi.fn>;
		off: ReturnType<typeof vi.fn>;
	};
	fileManager: {
		processFrontMatter: ReturnType<typeof vi.fn>;
	};
}

export function createMockApp(): MockApp {
	return {
		vault: {
			getAbstractFileByPath: vi.fn().mockReturnValue(null),
			read: vi.fn().mockResolvedValue(""),
			create: vi.fn().mockResolvedValue(undefined),
			modify: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			adapter: {
				exists: vi.fn().mockResolvedValue(false),
				read: vi.fn().mockResolvedValue(""),
				write: vi.fn().mockResolvedValue(undefined),
			},
			getRoot: vi.fn().mockReturnValue({ path: "/" }),
			getName: vi.fn().mockReturnValue("Test Vault"),
		},
		workspace: {
			getLeaf: vi.fn().mockReturnValue(null),
			getLeavesOfType: vi.fn().mockReturnValue([]),
			on: vi.fn().mockReturnValue({ id: "mock" }),
			off: vi.fn(),
			trigger: vi.fn(),
			activeLeaf: null,
		},
		metadataCache: {
			getFileCache: vi.fn().mockReturnValue(null),
			on: vi.fn().mockReturnValue({ id: "mock" }),
			off: vi.fn(),
		},
		fileManager: {
			processFrontMatter: vi.fn(),
		},
	} as unknown as MockApp;
}
