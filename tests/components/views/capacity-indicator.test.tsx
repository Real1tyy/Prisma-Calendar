import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { CapacityIndicator } from "../../../src/react/views/capacity-indicator";
import { createMockCalendarSettingsStore } from "../../fixtures/settings-fixtures";

function createMockBundle(settingsOverride: Record<string, unknown> = {}) {
	const store = createMockCalendarSettingsStore({
		capacityTrackingEnabled: true,
		hourStart: 8,
		hourEnd: 18,
		showDecimalHours: false,
		...settingsOverride,
	} as any);
	return {
		settingsStore: store,
		eventStore: {
			getEvents: vi.fn().mockResolvedValue([]),
			changes$: new Subject<void>().asObservable(),
		},
	} as any;
}

describe("CapacityIndicator", () => {
	it("renders nothing when capacity tracking is disabled", () => {
		const bundle = createMockBundle({ capacityTrackingEnabled: false });
		const { container } = render(<CapacityIndicator bundle={bundle} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders the indicator when tracking is enabled", async () => {
		const bundle = createMockBundle();
		render(<CapacityIndicator bundle={bundle} />);

		await waitFor(() => {
			expect(screen.getByTestId("prisma-capacity-indicator")).toBeInTheDocument();
		});
	});

	it("shows percentage in the label", async () => {
		const bundle = createMockBundle();
		render(<CapacityIndicator bundle={bundle} />);

		await waitFor(() => {
			const indicator = screen.getByTestId("prisma-capacity-indicator");
			expect(indicator.textContent).toContain("%");
		});
	});
});
