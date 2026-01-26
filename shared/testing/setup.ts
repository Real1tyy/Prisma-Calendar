import { vi } from "vitest";
import { mockFileOperations, mockLinkParser } from "./mocks/utils";

// Global test setup that can be imported once per test file
export function setupTestEnvironment() {
	// Mock the utils modules
	vi.mock("@obsidian-plugins/utils/file-operations", () => mockFileOperations);
	vi.mock("@obsidian-plugins/utils/link-parser", () => mockLinkParser);

	// Mock any plugin-specific components
	vi.mock("../src/components/settings-tab", () => ({
		TreePropertiesManagerSettingTab: class MockSettingTab {},
	}));

	// Return cleanup function
	return () => {
		vi.clearAllMocks();
	};
}
