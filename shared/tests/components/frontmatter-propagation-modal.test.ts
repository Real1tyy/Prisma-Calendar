import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	type FrontmatterPropagationModalOptions,
	showFrontmatterPropagationModal,
} from "../../src/components/primitives/frontmatter-propagation-modal";
import type { FrontmatterDiff } from "../../src/core/frontmatter/frontmatter-diff";

vi.mock("../../src/components/component-renderer/confirmation", () => ({
	showConfirmationModal: vi.fn(),
}));

import { showConfirmationModal } from "../../src/components/component-renderer/confirmation";

const mockShowConfirmation = vi.mocked(showConfirmationModal);

function createDiff(overrides?: Partial<FrontmatterDiff>): FrontmatterDiff {
	return {
		hasChanges: true,
		changes: [],
		added: [],
		modified: [],
		deleted: [],
		...overrides,
	};
}

function createOptions(overrides?: Partial<FrontmatterPropagationModalOptions>): FrontmatterPropagationModalOptions {
	return {
		eventTitle: "Weekly Review",
		diff: createDiff(),
		instanceCount: 5,
		onConfirm: vi.fn(),
		...overrides,
	};
}

describe("showFrontmatterPropagationModal", () => {
	let mockApp: App;

	beforeEach(() => {
		mockApp = {} as App;
		mockShowConfirmation.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should call showConfirmationModal with correct title", () => {
		showFrontmatterPropagationModal(mockApp, createOptions());

		expect(mockShowConfirmation).toHaveBeenCalledOnce();
		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.title).toBe("Propagate frontmatter changes?");
	});

	it("should pass confirm and cancel button text", () => {
		showFrontmatterPropagationModal(mockApp, createOptions());

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.confirmButton).toBe("Yes, propagate");
		expect(config.cancelButton).toBe("No, skip");
	});

	it("should pass onConfirm callback", () => {
		const onConfirm = vi.fn();
		showFrontmatterPropagationModal(mockApp, createOptions({ onConfirm }));

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.onConfirm).toBe(onConfirm);
	});

	it("should pass onCancel callback when provided", () => {
		const onCancel = vi.fn();
		showFrontmatterPropagationModal(mockApp, createOptions({ onCancel }));

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.onCancel).toBe(onCancel);
	});

	it("should not pass onCancel when not provided", () => {
		showFrontmatterPropagationModal(mockApp, createOptions());

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.onCancel).toBeUndefined();
	});

	it("should use custom cssPrefix in cls", () => {
		showFrontmatterPropagationModal(mockApp, createOptions({ cssPrefix: "my-plugin" }));

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.cls).toBe("my-plugin-modal");
	});

	it("should use default cssPrefix when not provided", () => {
		showFrontmatterPropagationModal(mockApp, createOptions());

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(config.cls).toBe("frontmatter-propagation-modal");
	});

	it("should render diff sections via the message function", () => {
		const diff = createDiff({
			added: [{ key: "tag", oldValue: undefined, newValue: "work", changeType: "added" }],
			modified: [{ key: "status", oldValue: "draft", newValue: "done", changeType: "modified" }],
			deleted: [{ key: "old-field", oldValue: "val", newValue: undefined, changeType: "deleted" }],
		});

		showFrontmatterPropagationModal(mockApp, createOptions({ diff, eventTitle: "Team Meeting", instanceCount: 3 }));

		const config = mockShowConfirmation.mock.calls[0][1];
		expect(typeof config.message).toBe("function");

		const el = document.createElement("div");
		(config.message as (el: HTMLElement) => void)(el);

		const description = el.querySelector("p");
		expect(description?.textContent).toContain("Team Meeting");
		expect(description?.textContent).toContain("3 instances");

		const headings = el.querySelectorAll("h4");
		expect(headings).toHaveLength(3);
	});

	it("should not render empty diff sections", () => {
		showFrontmatterPropagationModal(mockApp, createOptions({ diff: createDiff() }));

		const config = mockShowConfirmation.mock.calls[0][1];
		const el = document.createElement("div");
		(config.message as (el: HTMLElement) => void)(el);

		const headings = el.querySelectorAll("h4");
		expect(headings).toHaveLength(0);
	});
});
