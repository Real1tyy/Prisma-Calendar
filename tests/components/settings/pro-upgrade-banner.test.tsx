import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProUpgradeBanner } from "../../../src/react/settings/pro-upgrade-banner";

vi.mock("../../../src/core/pro-feature-previews", () => ({
	getFeatureDocUrl: vi.fn().mockReturnValue("https://example.com/docs/feature"),
	getFeaturePreviewSrc: vi.fn().mockReturnValue(null),
	getFeaturePurchaseUrl: vi.fn().mockReturnValue("https://example.com/buy/feature"),
}));

describe("ProUpgradeBanner", () => {
	it("renders feature name and description", () => {
		const { container } = render(
			<ProUpgradeBanner featureName="Test Feature" description="A great feature for testing." />
		);
		expect(container.textContent).toContain("Test Feature");
		expect(container.textContent).toContain("A great feature for testing.");
	});

	it("renders PRO badge", () => {
		const { container } = render(<ProUpgradeBanner featureName="Test Feature" description="Description" />);
		expect(container.querySelector(".prisma-pro-upgrade-badge")?.textContent).toBe("PRO");
	});

	it("renders purchase link", () => {
		const { container } = render(<ProUpgradeBanner featureName="Test Feature" description="Description" />);
		const link = container.querySelector<HTMLAnchorElement>(".prisma-pro-upgrade-link");
		expect(link).toBeTruthy();
		expect(link!.textContent).toContain("Start your free trial");
	});

	it("renders feature doc link when previewKey is provided", () => {
		const { container } = render(
			<ProUpgradeBanner featureName="AI Chat" description="AI description" previewKey="AI_CHAT" />
		);
		const docLink = container.querySelector<HTMLAnchorElement>(".prisma-pro-upgrade-doc-link");
		expect(docLink).toBeTruthy();
		expect(docLink!.textContent).toContain("View full feature documentation");
	});

	it("does not render feature doc link when no previewKey", () => {
		const { container } = render(<ProUpgradeBanner featureName="Test Feature" description="Description" />);
		const docLink = container.querySelector(".prisma-pro-upgrade-doc-link");
		expect(docLink).toBeNull();
	});

	it("renders trial text with learn more link", () => {
		const { container } = render(<ProUpgradeBanner featureName="Test Feature" description="Description" />);
		expect(container.textContent).toContain("30-day free trial");
		const learnMore = container.querySelector<HTMLAnchorElement>(".prisma-pro-upgrade-learn-more");
		expect(learnMore).toBeTruthy();
		expect(learnMore!.textContent).toContain("Learn more about Pro");
	});

	it("applies data-testid when previewKey is provided", () => {
		const { container } = render(
			<ProUpgradeBanner featureName="AI Chat" description="AI description" previewKey="AI_CHAT" />
		);
		const banner = container.querySelector("[data-testid='prisma-pro-gate-AI_CHAT']");
		expect(banner).toBeTruthy();
	});
});
