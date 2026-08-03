import type { Mock } from "@vitest/spy";
import { expect, vi } from "vitest";

/** The slice of a TFile these mocks read — kept structural so tests can pass literals. */
interface FileLike {
	basename?: string;
	path?: string;
	parent?: { path?: string } | null;
}

// File operations mocks
export const mockFileOperations = {
	arraysEqual: vi.fn<(a: unknown, b: unknown) => boolean>(),
	normalizeArray: vi.fn<(arr: unknown) => unknown[]>(),
	createFileLink: vi.fn<(file: FileLike | null | undefined) => string>(),
};

// Link parser mocks
export const mockLinkParser = {
	extractFilePathFromLink: vi.fn<(link: unknown) => string | null>(),
};

// Default mock implementations that match the actual behavior
export function setupDefaultMockImplementations() {
	// Set up file operations mocks
	mockFileOperations.normalizeArray.mockImplementation((arr) =>
		Array.isArray(arr) ? (arr as unknown[]) : arr ? [arr] : []
	);

	mockFileOperations.arraysEqual.mockImplementation((a, b) => JSON.stringify(a) === JSON.stringify(b));

	mockFileOperations.createFileLink.mockImplementation((file) => {
		if (!file) return "[[Unknown File]]";

		const basename =
			file.basename ||
			file.path
				?.split("/")
				.pop()
				?.replace(/\.[^/.]+$/, "") ||
			"";
		const parentPath = file.parent?.path;

		if (!parentPath || parentPath === "/" || parentPath === "") {
			return `[[${basename}]]`;
		}

		return `[[${parentPath}/${basename}|${basename}]]`;
	});

	// Set up link parser mocks
	mockLinkParser.extractFilePathFromLink.mockImplementation((link) => {
		if (!link || typeof link !== "string") return null;

		// Handle text that contains a link
		const linkMatch = link.match(/\[\[([^\]]+)\]\]/);
		if (linkMatch) {
			const content = linkMatch[1];
			// Remove display name if present
			const filePart = content.split("|")[0].trim();
			if (!filePart) return null;

			// Add .md extension if not present
			return filePart.endsWith(".md") ? filePart : `${filePart}.md`;
		}

		return null;
	});
}

// Reset all mocks
export function resetAllMocks() {
	Object.values(mockFileOperations).forEach((mock) => {
		mock.mockReset();
	});
	Object.values(mockLinkParser).forEach((mock) => {
		mock.mockReset();
	});
}

type MockName = keyof typeof mockFileOperations | keyof typeof mockLinkParser;

/**
 * Resolve a mock by name as the erased `Mock` type. The two registries hold
 * different call signatures, so the union cannot be driven directly — every
 * helper below only reaches the signature-agnostic spy surface.
 */
function resolveMock(mockName: MockName): Mock {
	if (mockName in mockFileOperations) {
		return mockFileOperations[mockName as keyof typeof mockFileOperations] as Mock;
	}
	return mockLinkParser[mockName as keyof typeof mockLinkParser] as Mock;
}

// Helper to setup mocks with specific implementations
export function setupMockImplementation(mockName: MockName, implementation: (...args: unknown[]) => unknown) {
	resolveMock(mockName).mockImplementation(implementation);
}

// Helper to setup mock return values
export function setupMockReturnValue(mockName: MockName, value: unknown) {
	resolveMock(mockName).mockReturnValue(value);
}

// Helper to verify mock calls
export function verifyMockCalls(mockName: MockName, expectedCalls: unknown[][]) {
	const mock = resolveMock(mockName);

	expect(mock).toHaveBeenCalledTimes(expectedCalls.length);
	expectedCalls.forEach((args, index) => {
		expect(mock).toHaveBeenNthCalledWith(index + 1, ...args);
	});
}
