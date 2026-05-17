import { ReleaseCheckService } from "@real1ty-obsidian-plugins";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UpdateAvailableBadge } from "../../src/components/update-available-badge";
import { renderWithTheme } from "../helpers/render-react";

function buildService(remoteTag: string | null) {
	const fetchRelease = vi.fn().mockResolvedValue(
		remoteTag
			? {
					tag_name: remoteTag,
					html_url: `https://github.com/Real1tyy/Prisma-Calendar/releases/tag/${remoteTag}`,
					published_at: "2026-05-01T12:00:00Z",
					draft: false,
					prerelease: false,
				}
			: null
	);
	return new ReleaseCheckService(
		{
			owner: "Real1tyy",
			repo: "Prisma-Calendar",
			currentVersion: "1.0.0",
			storageKey: `test:prisma-calendar:update-check:${Math.random()}`,
		},
		{ now: () => 0, fetchRelease }
	);
}

describe("UpdateAvailableBadge", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.restoreAllMocks();
	});

	it("renders nothing when there is no update", () => {
		const service = buildService(null);
		const { container } = renderWithTheme(<UpdateAvailableBadge service={service} />, "prisma-");
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing while no service is wired in", () => {
		const { container } = renderWithTheme(<UpdateAvailableBadge service={null} />, "prisma-");
		expect(container.firstChild).toBeNull();
	});

	it("renders the badge once an update arrives on the stream", async () => {
		const service = buildService("v2.0.0");
		renderWithTheme(<UpdateAvailableBadge service={service} testId="prisma-update-badge" />, "prisma-");
		const badge = await screen.findByTestId("prisma-update-badge");
		expect(badge.textContent).toContain("Update available");
		expect(badge.textContent).toContain("v2.0.0");
	});

	it("opens the release url when clicked", async () => {
		const service = buildService("v2.0.0");
		const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
		const { user } = renderWithTheme(
			<UpdateAvailableBadge service={service} testId="prisma-update-badge" />,
			"prisma-"
		);
		const badge = await screen.findByTestId("prisma-update-badge");
		await user.click(badge);
		expect(openSpy).toHaveBeenCalledWith(
			"https://github.com/Real1tyy/Prisma-Calendar/releases/tag/2.0.0",
			"_blank",
			"noopener,noreferrer"
		);
	});

	it("renders a non-clickable span when hrefOverride is null", async () => {
		const service = buildService("v2.0.0");
		renderWithTheme(
			<UpdateAvailableBadge service={service} hrefOverride={null} testId="prisma-update-badge" />,
			"prisma-"
		);
		const badge = await screen.findByTestId("prisma-update-badge");
		expect(badge.tagName).toBe("SPAN");
	});
});
