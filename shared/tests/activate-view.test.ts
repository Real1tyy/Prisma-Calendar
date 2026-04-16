import type { Workspace, WorkspaceLeaf } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { activateView, type ActivateViewConfig } from "../src/utils/activate-view";

function createMockLeaf(): WorkspaceLeaf {
	return {
		setViewState: vi.fn().mockResolvedValue(undefined),
	} as unknown as WorkspaceLeaf;
}

function createMockWorkspace(existingLeaves: WorkspaceLeaf[] = []): Workspace {
	return {
		getLeavesOfType: vi.fn().mockReturnValue(existingLeaves),
		revealLeaf: vi.fn().mockResolvedValue(undefined),
		detachLeavesOfType: vi.fn(),
		getLeaf: vi.fn().mockReturnValue(createMockLeaf()),
		getLeftLeaf: vi.fn().mockReturnValue(createMockLeaf()),
		getRightLeaf: vi.fn().mockReturnValue(createMockLeaf()),
	} as unknown as Workspace;
}

describe("activateView", () => {
	let workspace: Workspace;

	beforeEach(() => {
		workspace = createMockWorkspace();
	});

	describe("when no existing leaf is open", () => {
		it("should create a new tab leaf and set view state", async () => {
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab" };

			const result = await activateView(workspace, config);

			expect(workspace.getLeaf).toHaveBeenCalledWith("tab");
			expect(result).not.toBeNull();
			expect(result!.setViewState).toHaveBeenCalledWith({ type: "my-view", active: true });
			expect(workspace.revealLeaf).toHaveBeenCalledWith(result);
		});

		it("should create a left sidebar leaf", async () => {
			const config: ActivateViewConfig = { viewType: "my-view", placement: "left-sidebar" };

			await activateView(workspace, config);

			expect(workspace.getLeftLeaf).toHaveBeenCalledWith(false);
		});

		it("should create a right sidebar leaf", async () => {
			const config: ActivateViewConfig = { viewType: "my-view", placement: "right-sidebar" };

			await activateView(workspace, config);

			expect(workspace.getRightLeaf).toHaveBeenCalledWith(false);
		});

		it("should call onReveal with the new leaf", async () => {
			const onReveal = vi.fn();
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab", onReveal };

			const result = await activateView(workspace, config);

			expect(onReveal).toHaveBeenCalledWith(result);
		});

		it("should return null when getOrCreateLeaf returns null", async () => {
			(workspace.getLeftLeaf as ReturnType<typeof vi.fn>).mockReturnValue(null);
			const config: ActivateViewConfig = { viewType: "my-view", placement: "left-sidebar" };

			const result = await activateView(workspace, config);

			expect(result).toBeNull();
		});
	});

	describe("when an existing leaf is open", () => {
		it("should reveal the existing leaf", async () => {
			const existingLeaf = createMockLeaf();
			workspace = createMockWorkspace([existingLeaf]);
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab" };

			const result = await activateView(workspace, config);

			expect(workspace.revealLeaf).toHaveBeenCalledWith(existingLeaf);
			expect(result).toBe(existingLeaf);
			expect(workspace.getLeaf).not.toHaveBeenCalled();
		});

		it("should call onReveal with the existing leaf", async () => {
			const existingLeaf = createMockLeaf();
			workspace = createMockWorkspace([existingLeaf]);
			const onReveal = vi.fn();
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab", onReveal };

			await activateView(workspace, config);

			expect(onReveal).toHaveBeenCalledWith(existingLeaf);
		});
	});

	describe("toggle behavior", () => {
		it("should detach existing leaves when toggle is true", async () => {
			const existingLeaf = createMockLeaf();
			workspace = createMockWorkspace([existingLeaf]);
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab", toggle: true };

			const result = await activateView(workspace, config);

			expect(workspace.detachLeavesOfType).toHaveBeenCalledWith("my-view");
			expect(result).toBeNull();
		});

		it("should create a new leaf when toggle is true but no existing leaf", async () => {
			const config: ActivateViewConfig = { viewType: "my-view", placement: "tab", toggle: true };

			const result = await activateView(workspace, config);

			expect(workspace.detachLeavesOfType).not.toHaveBeenCalled();
			expect(result).not.toBeNull();
		});
	});
});
