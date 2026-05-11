import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { UntrackedEventsDropdown } from "../../../src/react/views/untracked-events-dropdown";
import { eventDefaults, type UntrackedEvent } from "../../../src/types/calendar";
import { createMockReactBundle, renderWithContexts } from "../../fixtures/react-view-fixtures";

vi.mock("../../../src/core/api/modal-actions", () => ({
	openCreateUntrackedEventModal: vi.fn(),
}));

vi.mock("@real1ty-obsidian-plugins", async (importOriginal) => {
	const actual: Record<string, unknown> = await importOriginal();
	return {
		...actual,
		ColorEvaluator: class {
			evaluateColor() {
				return null;
			}
			destroy() {}
		},
	};
});

// VirtualList relies on measured DOM (offsetHeight) for virtualization. jsdom
// reports 0 for unmeasured nodes so no items would render. Replace it with a
// plain map that renders every item — enough for the assertions below.
vi.mock("@real1ty-obsidian-plugins-react", async (importOriginal) => {
	const actual: Record<string, unknown> = await importOriginal();
	return {
		...actual,
		VirtualList: ({
			items,
			renderItem,
			getKey,
			className,
		}: {
			items: unknown[];
			renderItem: (item: unknown, index: number) => React.ReactNode;
			getKey: (item: unknown, index: number) => string;
			className?: string;
		}) => (
			<div className={className}>
				{items.map((item, i) => (
					<div key={getKey(item, i)}>{renderItem(item, i)}</div>
				))}
			</div>
		),
	};
});

function makeUntracked(filePath: string, title: string): UntrackedEvent {
	return {
		...eventDefaults(),
		id: filePath,
		ref: { filePath },
		title,
		type: "untracked",
		meta: {},
	} as UntrackedEvent;
}

function setupBundle(events: UntrackedEvent[] = []) {
	const bundle = createMockReactBundle({ settings: { showStopwatch: false } as any });
	const changes$ = new Subject<void>();
	(bundle as any).untrackedEventStore = {
		changes$: changes$.asObservable(),
		getUntrackedEvents: () => events,
		_emit: () => changes$.next(),
	};
	return bundle;
}

function renderDropdown(events: UntrackedEvent[] = []) {
	const bundle = setupBundle(events);
	const result = renderWithContexts(<UntrackedEventsDropdown bundle={bundle} />, { bundle });
	return { ...result, bundle };
}

describe("UntrackedEventsDropdown", () => {
	it("renders the toggle button", () => {
		renderDropdown();
		expect(screen.getByTestId("prisma-untracked-dropdown-button")).toBeInTheDocument();
		expect(screen.queryByTestId("prisma-untracked-dropdown")).not.toBeInTheDocument();
	});

	it("opens the panel on click and shows empty state when no events", async () => {
		renderDropdown();
		const user = userEvent.setup();

		await user.click(screen.getByTestId("prisma-untracked-dropdown-button"));

		expect(screen.getByTestId("prisma-untracked-dropdown")).toBeInTheDocument();
		expect(screen.getByText("No untracked events")).toBeInTheDocument();
	});

	it("renders one row per untracked event when open", async () => {
		const events = [makeUntracked("Tasks/A.md", "Alpha Task"), makeUntracked("Tasks/B.md", "Bravo Task")];
		renderDropdown(events);
		const user = userEvent.setup();

		await user.click(screen.getByTestId("prisma-untracked-dropdown-button"));
		const items = screen.getAllByTestId("prisma-untracked-dropdown-item");
		expect(items).toHaveLength(2);
	});

	it("filters items by case-insensitive search query", async () => {
		const events = [makeUntracked("Tasks/A.md", "Alpha Task"), makeUntracked("Tasks/B.md", "Bravo Task")];
		renderDropdown(events);
		const user = userEvent.setup();

		await user.click(screen.getByTestId("prisma-untracked-dropdown-button"));
		await user.type(screen.getByTestId("prisma-untracked-search"), "bra");

		const items = screen.getAllByTestId("prisma-untracked-dropdown-item");
		expect(items).toHaveLength(1);
		expect(items[0]).toHaveTextContent("Bravo Task");
	});

	it("unsubscribes from the store on unmount (no leak)", () => {
		const { unmount, bundle } = renderDropdown([makeUntracked("a.md", "A")]);
		const store = (bundle as any).untrackedEventStore;
		unmount();
		expect(() => store._emit()).not.toThrow();
	});
});
