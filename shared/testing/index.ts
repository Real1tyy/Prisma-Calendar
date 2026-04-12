// ─── Mocks (vi.fn()-based, for lightweight stubbing) ─────────────
export * from "./mocks/license";
export * from "./mocks/obsidian";
export {
	createMockApp,
	createMockFile,
	createMockFileCache,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "./mocks/obsidian";
export * from "./mocks/utils";
export {
	mockFileOperations,
	mockLinkParser,
	resetAllMocks,
	setupDefaultMockImplementations,
	setupMockImplementation,
	setupMockReturnValue,
	verifyMockCalls,
} from "./mocks/utils";
export * from "./mocks/vault-table";

// ─── Fakes (in-memory implementations with real semantics) ───────
export type {
	FakeAppResult,
	FakeFileManager,
	FakeMetadataCache,
	FakeVaultInstance,
	FakeVaultOptions,
	FakeWorkspace,
} from "./fakes/fake-vault";
export { createFakeApp } from "./fakes/fake-vault";

// ─── Async test primitives ───────────────────────────────────────
export type { Deferred, DeferredVoid } from "./deferred";
export { createDeferred, createDeferredVoid } from "./deferred";

// ─── Approval / snapshot test helpers ────────────────────────────
export { normalizeApprovalOutput, renderToApprovalString } from "./approval";

// ─── Time control ────────────────────────────────────────────────
export { advanceDebounce, advanceTimersAndFlush, pinDateNow, withFakeTimers } from "./time";

// ─── Event helpers ───────────────────────────────────────────────
export { captureEvents, createTestEventEmitter, waitForEvent } from "./event-helpers";
