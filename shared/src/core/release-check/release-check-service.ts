import { requestUrl } from "obsidian";
import { BehaviorSubject } from "rxjs";
import { z } from "zod";

import { LocalKV } from "../storage";
import { compareVersions } from "./compare-versions";
import {
	ReleaseUpdateNoticeSchema,
	type GitHubRelease,
	type ReleaseCheckServiceConfig,
	type ReleaseUpdateNotice,
} from "./types";

export const RELEASE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const PersistedStateSchema = z.object({
	checkedAt: z.number(),
	notice: ReleaseUpdateNoticeSchema.nullable(),
});

type PersistedState = z.infer<typeof PersistedStateSchema>;

export interface ReleaseCheckServiceOptions {
	now?: () => number;
	fetchRelease?: (owner: string, repo: string) => Promise<GitHubRelease | null>;
}

async function fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
	const response = await requestUrl({
		url: `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
		method: "GET",
		headers: { Accept: "application/vnd.github+json", "User-Agent": `${owner}-${repo}-update-check` },
		throw: false,
	});
	if (response.status < 200 || response.status >= 300) return null;
	return (response.json as GitHubRelease | null) ?? null;
}

export class ReleaseCheckService {
	private readonly store: LocalKV<PersistedState>;
	private readonly now: () => number;
	private readonly fetchRelease: (owner: string, repo: string) => Promise<GitHubRelease | null>;
	readonly notice$: BehaviorSubject<ReleaseUpdateNotice | null>;

	constructor(
		private readonly config: ReleaseCheckServiceConfig,
		options: ReleaseCheckServiceOptions = {}
	) {
		this.now = options.now ?? (() => Date.now());
		this.fetchRelease = options.fetchRelease ?? fetchLatestRelease;
		this.store = new LocalKV({ namespace: config.storageKey, schema: PersistedStateSchema });
		const cached = this.store.get("state")?.notice ?? null;
		this.notice$ = new BehaviorSubject<ReleaseUpdateNotice | null>(this.acceptIfFresher(cached));
	}

	async checkForUpdates(): Promise<ReleaseUpdateNotice | null> {
		if (this.config.isEnabled?.() === false) return this.notice$.getValue();

		const persisted = this.store.get("state");
		if (persisted && this.now() - persisted.checkedAt < RELEASE_CHECK_INTERVAL_MS) {
			return this.notice$.getValue();
		}

		const release = await this.fetchRelease(this.config.owner, this.config.repo).catch((error: unknown) => {
			console.warn(`[release-check] ${this.config.owner}/${this.config.repo} fetch failed`, error);
			return null;
		});

		const notice = this.toNotice(release);
		this.store.set("state", { checkedAt: this.now(), notice });
		this.notice$.next(notice);
		return notice;
	}

	private toNotice(release: GitHubRelease | null): ReleaseUpdateNotice | null {
		if (!release || release.draft || release.prerelease) return null;
		return this.acceptIfFresher({
			version: release.tag_name.replace(/^v/i, ""),
			publishedAt: release.published_at,
			url: release.html_url.replace(/\/tag\/v(?=\d)/i, "/tag/"),
		});
	}

	private acceptIfFresher(notice: ReleaseUpdateNotice | null): ReleaseUpdateNotice | null {
		if (!notice) return null;
		return compareVersions(notice.version, this.config.currentVersion) > 0 ? notice : null;
	}
}
