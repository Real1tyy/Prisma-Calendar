import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it } from "vitest";

import { BundleContext } from "../../../src/react/contexts/bundle-context";
import { ProGatedContent } from "../../../src/react/views/pro-gated-content";

function createMockBundle(isPro: boolean) {
	return {
		plugin: {
			licenseManager: {
				isPro,
				isPro$: new BehaviorSubject(isPro),
			},
		},
	} as any;
}

describe("ProGatedContent", () => {
	it("renders children when Pro is active", () => {
		render(
			<BundleContext value={createMockBundle(true)}>
				<ProGatedContent featureName="Heatmap" description="View event density">
					<div data-testid="pro-child">Pro content</div>
				</ProGatedContent>
			</BundleContext>
		);
		expect(screen.getByTestId("pro-child")).toBeInTheDocument();
		expect(screen.queryByTestId("prisma-pro-gated")).not.toBeInTheDocument();
	});

	it("renders upgrade banner when not Pro", () => {
		render(
			<BundleContext value={createMockBundle(false)}>
				<ProGatedContent featureName="Heatmap" description="View event density">
					<div data-testid="pro-child">Pro content</div>
				</ProGatedContent>
			</BundleContext>
		);
		expect(screen.queryByTestId("pro-child")).not.toBeInTheDocument();
		expect(screen.getByTestId("prisma-pro-gated")).toBeInTheDocument();
		expect(screen.getByText("Heatmap")).toBeInTheDocument();
		expect(screen.getByText("View event density")).toBeInTheDocument();
	});
});
