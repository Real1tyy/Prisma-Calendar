import { vi } from "vitest";

import type { MockApp } from "../mocks/obsidian";

/** Factory for a mock Obsidian Vault with all common methods stubbed. */
export function createMockVault(overrides: Partial<MockApp["vault"]> = {}): MockApp["vault"] {
	return {
		getAbstractFileByPath: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		read: vi.fn(),
		cachedRead: vi.fn(),
		modify: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
		rename: vi.fn(),
		getFiles: vi.fn().mockReturnValue([]),
		getMarkdownFiles: vi.fn().mockReturnValue([]),
		getFolderByPath: vi.fn(),
		...overrides,
	};
}

/** Factory for a mock MetadataCache. */
export function createMockMetadataCache(overrides: Partial<MockApp["metadataCache"]> = {}): MockApp["metadataCache"] {
	return {
		getFileCache: vi.fn(),
		on: vi.fn().mockReturnValue({ id: "mock-event-ref" }),
		offref: vi.fn(),
		...overrides,
	};
}

/** Factory for a composite mock App used in integration tests. */
export function createMockIntegrationApp(overrides: Partial<MockApp> = {}): MockApp & { workspace: any } {
	return {
		vault: createMockVault(overrides.vault),
		metadataCache: createMockMetadataCache(overrides.metadataCache),
		fileManager: {
			processFrontMatter: vi.fn(),
			renameFile: vi.fn().mockResolvedValue(undefined),
			...overrides.fileManager,
		},
		workspace: {
			getActiveFile: vi.fn(),
			on: vi.fn(),
			getLeaf: vi.fn().mockReturnValue({
				openFile: vi.fn(),
			}),
			...((overrides as any).workspace ?? {}),
		},
	};
}
