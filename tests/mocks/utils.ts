import { expect, vi } from "vitest";

// File operations mocks
export const mockFileOperations = {
	arraysEqual: vi.fn(),
	normalizeArray: vi.fn(),
	createFileLink: vi.fn(),
};

// Link parser mocks
export const mockLinkParser = {
	extractFilePathFromLink: vi.fn(),
};

// Default mock implementations that match the actual behavior
export function setupDefaultMockImplementations() {
	// Set up file operations mocks
	mockFileOperations.normalizeArray.mockImplementation((arr) => (Array.isArray(arr) ? arr : arr ? [arr] : []));

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

// Helper to setup mocks with specific implementations
export function setupMockImplementation(
	mockName: keyof typeof mockFileOperations | keyof typeof mockLinkParser,
	implementation: (...args: any[]) => any
) {
	if (mockName in mockFileOperations) {
		(mockFileOperations as any)[mockName].mockImplementation(implementation);
	} else if (mockName in mockLinkParser) {
		(mockLinkParser as any)[mockName].mockImplementation(implementation);
	}
}

// Helper to setup mock return values
export function setupMockReturnValue(
	mockName: keyof typeof mockFileOperations | keyof typeof mockLinkParser,
	value: any
) {
	if (mockName in mockFileOperations) {
		(mockFileOperations as any)[mockName].mockReturnValue(value);
	} else if (mockName in mockLinkParser) {
		(mockLinkParser as any)[mockName].mockReturnValue(value);
	}
}

// Helper to verify mock calls
export function verifyMockCalls(
	mockName: keyof typeof mockFileOperations | keyof typeof mockLinkParser,
	expectedCalls: any[][]
) {
	const mock =
		mockName in mockFileOperations ? (mockFileOperations as any)[mockName] : (mockLinkParser as any)[mockName];

	expect(mock).toHaveBeenCalledTimes(expectedCalls.length);
	expectedCalls.forEach((args, index) => {
		expect(mock).toHaveBeenNthCalledWith(index + 1, ...args);
	});
}
