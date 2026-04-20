import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as TransferCoreModule from "../../../shared/src/core/settings/settings-transfer";
import { AppContext } from "../../src/contexts/app-context";
import { SettingsTransferButtons } from "../../src/settings/settings-transfer";
import { makeStore } from "../helpers/make-store";
import { renderReact } from "../helpers/render-react";

const confirmActionMock = vi.fn<() => Promise<boolean>>();
const noticeMessages: string[] = [];

vi.mock("@real1ty-obsidian-plugins", async () => {
	const transfer = await vi.importActual<typeof TransferCoreModule>(
		"../../../shared/src/core/settings/settings-transfer"
	);
	return {
		...transfer,
		confirmAction: () => confirmActionMock(),
	};
});

vi.mock("obsidian", () => ({
	Notice: class {
		constructor(message: string) {
			noticeMessages.push(message);
		}
	},
}));

interface CapturedModal {
	mode: "export" | "import";
	initialJson: string;
	filename: string;
	onImport: (parsed: unknown) => Promise<void>;
	testIdPrefix?: string;
}

const modalCalls: CapturedModal[] = [];

vi.mock("../../src/settings/settings-transfer/transfer-modal", () => ({
	openTransferModal: (config: CapturedModal) => {
		modalCalls.push(config);
	},
}));

interface TestSettings {
	enabled: boolean;
	maxItems: number;
	secret: string;
	[key: string]: unknown;
}

const DEFAULTS: TestSettings = {
	enabled: true,
	maxItems: 10,
	secret: "",
};

const fakeApp = {} as never;

function renderButtons(store = makeStore<TestSettings>(structuredClone(DEFAULTS))) {
	return {
		store,
		...renderReact(
			<AppContext value={fakeApp}>
				<SettingsTransferButtons
					store={store}
					defaults={DEFAULTS}
					nonTransferableKeys={["secret"]}
					filename="test-settings.json"
					testIdPrefix="test-transfer"
				/>
			</AppContext>
		),
	};
}

describe("SettingsTransferButtons", () => {
	beforeEach(() => {
		modalCalls.length = 0;
		confirmActionMock.mockReset();
		noticeMessages.length = 0;
	});

	it("renders a settings row with the default heading + description", () => {
		renderButtons();
		expect(screen.getByText("Import and export settings")).toBeInTheDocument();
		expect(screen.getByText(/replaces all settings/i)).toBeInTheDocument();
	});

	it("stamps testIdPrefix-driven data-testids on the row and both buttons", () => {
		renderButtons();
		expect(screen.getByTestId("test-transfer-row")).toBeInTheDocument();
		expect(screen.getByTestId("test-transfer-import-button")).toBeInTheDocument();
		expect(screen.getByTestId("test-transfer-export-button")).toBeInTheDocument();
	});

	it("opens an export modal pre-filled with a full snapshot (minus blocked keys)", async () => {
		const store = makeStore<TestSettings>({ ...DEFAULTS, enabled: false, maxItems: 42 });
		const { user } = renderButtons(store);

		await user.click(screen.getByTestId("test-transfer-export-button"));

		expect(modalCalls).toHaveLength(1);
		const modal = modalCalls[0]!;
		expect(modal.mode).toBe("export");
		expect(modal.filename).toBe("test-settings.json");
		expect(JSON.parse(modal.initialJson)).toEqual({ enabled: false, maxItems: 42 });
	});

	it("opens an import modal whose onImport persists merged settings via the store", async () => {
		const store = makeStore<TestSettings>({ ...DEFAULTS, secret: "KEEP" });
		const { user } = renderButtons(store);

		await user.click(screen.getByTestId("test-transfer-import-button"));

		expect(modalCalls).toHaveLength(1);
		const modal = modalCalls[0]!;
		expect(modal.mode).toBe("import");
		expect(modal.initialJson).toBe("");

		await modal.onImport({ enabled: false, maxItems: 99, secret: "STOLEN" });

		const next = store.currentSettings;
		expect(next.enabled).toBe(false);
		expect(next.maxItems).toBe(99);
		expect(next.secret).toBe("KEEP");
	});

	it("invokes onImport callback after a successful import", async () => {
		const store = makeStore<TestSettings>(structuredClone(DEFAULTS));
		const onImport = vi.fn();
		renderReact(
			<AppContext value={fakeApp}>
				<SettingsTransferButtons
					store={store}
					defaults={DEFAULTS}
					filename="test.json"
					onImport={onImport}
					testIdPrefix="test-transfer"
				/>
			</AppContext>
		);

		const { user } = { user: (await import("@testing-library/user-event")).userEvent.setup() };
		await user.click(screen.getByTestId("test-transfer-import-button"));
		const modal = modalCalls.at(-1)!;
		await modal.onImport({ enabled: false });

		expect(onImport).toHaveBeenCalledTimes(1);
		expect(onImport.mock.calls[0]?.[0]).toMatchObject({ enabled: false });
	});

	it("shows a reset button by default and hides it when hideResetButton is set", () => {
		renderButtons();
		expect(screen.getByTestId("test-transfer-reset-button")).toBeInTheDocument();

		const store = makeStore<TestSettings>(structuredClone(DEFAULTS));
		renderReact(
			<AppContext value={fakeApp}>
				<SettingsTransferButtons store={store} defaults={DEFAULTS} hideResetButton testIdPrefix="hidden-reset" />
			</AppContext>
		);
		expect(screen.queryByTestId("hidden-reset-reset-button")).toBeNull();
	});

	it("restores every transferable key to its default when the user confirms the reset", async () => {
		const store = makeStore<TestSettings>({ ...DEFAULTS, enabled: false, maxItems: 99, secret: "KEEP" });
		const { user } = renderButtons(store);
		confirmActionMock.mockResolvedValueOnce(true);

		await user.click(screen.getByTestId("test-transfer-reset-button"));

		expect(confirmActionMock).toHaveBeenCalledTimes(1);
		const next = store.currentSettings;
		expect(next.enabled).toBe(DEFAULTS.enabled);
		expect(next.maxItems).toBe(DEFAULTS.maxItems);
		expect(next.secret).toBe("KEEP");
		expect(noticeMessages).toContain("Settings reset to defaults.");
	});

	it("does nothing when the user cancels the reset confirmation", async () => {
		const initial = { ...DEFAULTS, enabled: false, maxItems: 42 };
		const store = makeStore<TestSettings>(structuredClone(initial));
		const { user } = renderButtons(store);
		confirmActionMock.mockResolvedValueOnce(false);

		await user.click(screen.getByTestId("test-transfer-reset-button"));

		expect(confirmActionMock).toHaveBeenCalledTimes(1);
		expect(store.currentSettings).toEqual(initial);
		expect(noticeMessages).toEqual([]);
	});

	it("invokes onReset after a successful reset with the new settings", async () => {
		const onReset = vi.fn();
		const store = makeStore<TestSettings>({ ...DEFAULTS, enabled: false });
		confirmActionMock.mockResolvedValueOnce(true);

		const { user } = renderReact(
			<AppContext value={fakeApp}>
				<SettingsTransferButtons
					store={store}
					defaults={DEFAULTS}
					nonTransferableKeys={["secret"]}
					onReset={onReset}
					testIdPrefix="with-on-reset"
				/>
			</AppContext>
		);

		await user.click(screen.getByTestId("with-on-reset-reset-button"));

		expect(onReset).toHaveBeenCalledTimes(1);
		expect(onReset.mock.calls[0]?.[0]).toMatchObject({ enabled: true });
	});
});
