import { beforeEach, describe, expect, it, vi } from "vitest";

import { RELEASE_CHECK_INTERVAL_MS, ReleaseCheckService } from "../../../src/core/release-check/release-check-service";
import type { GitHubRelease } from "../../../src/core/release-check/types";

const CONFIG = {
	owner: "Real1tyy",
	repo: "Prisma-Calendar",
	currentVersion: "1.0.0",
	storageKey: "test:prisma-calendar:release-check",
};

function makeRelease(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
	return {
		tag_name: "v2.0.0",
		html_url: "https://github.com/foo/bar/releases/tag/v2.0.0",
		published_at: "2026-05-01T12:00:00Z",
		draft: false,
		prerelease: false,
		...overrides,
	};
}

describe("ReleaseCheckService", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("publishes an update when the remote release is newer", async () => {
		const service = new ReleaseCheckService(CONFIG, {
			now: () => 1_000,
			fetchRelease: vi.fn().mockResolvedValue(makeRelease()),
		});
		const notice = await service.checkForUpdates();
		expect(notice).toEqual({
			version: "2.0.0",
			publishedAt: "2026-05-01T12:00:00Z",
			url: "https://github.com/foo/bar/releases/tag/v2.0.0",
		});
		expect(service.notice$.getValue()).toEqual(notice);
	});

	it("returns null when remote version equals or precedes current", async () => {
		const fetchRelease = vi
			.fn()
			.mockResolvedValueOnce(makeRelease({ tag_name: "v1.0.0" }))
			.mockResolvedValueOnce(makeRelease({ tag_name: "v0.5.0" }));
		const a = new ReleaseCheckService(CONFIG, { now: () => 1, fetchRelease });
		expect(await a.checkForUpdates()).toBeNull();
		window.localStorage.clear();
		const b = new ReleaseCheckService(CONFIG, { now: () => 1, fetchRelease });
		expect(await b.checkForUpdates()).toBeNull();
	});

	it("filters out drafts and prereleases", async () => {
		const fetchRelease = vi
			.fn()
			.mockResolvedValueOnce(makeRelease({ draft: true }))
			.mockResolvedValueOnce(makeRelease({ prerelease: true }));
		const a = new ReleaseCheckService(CONFIG, { now: () => 1, fetchRelease });
		expect(await a.checkForUpdates()).toBeNull();
		window.localStorage.clear();
		const b = new ReleaseCheckService(CONFIG, { now: () => 1, fetchRelease });
		expect(await b.checkForUpdates()).toBeNull();
	});

	it("skips fetches inside the 24h window and re-fetches after it elapses", async () => {
		const fetchRelease = vi.fn().mockResolvedValue(makeRelease());
		let nowValue = 1_000;
		const service = new ReleaseCheckService(CONFIG, { now: () => nowValue, fetchRelease });

		await service.checkForUpdates();
		nowValue = 1_000 + RELEASE_CHECK_INTERVAL_MS - 1;
		await service.checkForUpdates();
		await service.checkForUpdates();
		expect(fetchRelease).toHaveBeenCalledTimes(1);

		nowValue = 1_000 + RELEASE_CHECK_INTERVAL_MS + 1;
		await service.checkForUpdates();
		expect(fetchRelease).toHaveBeenCalledTimes(2);
	});

	it("rehydrates a cached notice on construction", async () => {
		const fetchRelease = vi.fn().mockResolvedValue(makeRelease());
		const first = new ReleaseCheckService(CONFIG, { now: () => 1_000, fetchRelease });
		await first.checkForUpdates();

		const second = new ReleaseCheckService(CONFIG, { now: () => 1_500, fetchRelease: vi.fn() });
		expect(second.notice$.getValue()).toEqual({
			version: "2.0.0",
			publishedAt: "2026-05-01T12:00:00Z",
			url: "https://github.com/foo/bar/releases/tag/v2.0.0",
		});
	});

	it("drops a cached notice that the running version has caught up to", async () => {
		const fetchRelease = vi.fn().mockResolvedValue(makeRelease());
		const first = new ReleaseCheckService(CONFIG, { now: () => 1_000, fetchRelease });
		await first.checkForUpdates();

		const upgraded = new ReleaseCheckService(
			{ ...CONFIG, currentVersion: "2.0.0" },
			{ now: () => 2_000, fetchRelease: vi.fn() }
		);
		expect(upgraded.notice$.getValue()).toBeNull();
	});

	it("skips the fetch entirely when isEnabled returns false", async () => {
		const fetchRelease = vi.fn().mockResolvedValue(makeRelease());
		const service = new ReleaseCheckService({ ...CONFIG, isEnabled: () => false }, { now: () => 1_000, fetchRelease });
		expect(await service.checkForUpdates()).toBeNull();
		expect(fetchRelease).not.toHaveBeenCalled();
		expect(service.notice$.getValue()).toBeNull();
	});

	it("resumes fetching once isEnabled flips back to true", async () => {
		const fetchRelease = vi.fn().mockResolvedValue(makeRelease());
		let enabled = false;
		const service = new ReleaseCheckService(
			{ ...CONFIG, isEnabled: () => enabled },
			{ now: () => 1_000, fetchRelease }
		);
		await service.checkForUpdates();
		expect(fetchRelease).not.toHaveBeenCalled();

		enabled = true;
		const notice = await service.checkForUpdates();
		expect(fetchRelease).toHaveBeenCalledTimes(1);
		expect(notice?.version).toBe("2.0.0");
	});

	it("returns null and logs when the fetch throws", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const service = new ReleaseCheckService(CONFIG, {
			now: () => 1_000,
			fetchRelease: vi.fn().mockRejectedValue(new Error("network")),
		});
		expect(await service.checkForUpdates()).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
