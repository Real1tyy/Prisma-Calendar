import { z } from "zod";

export const ReleaseUpdateNoticeSchema = z.object({
	version: z.string(),
	publishedAt: z.string(),
	url: z.string(),
});

export type ReleaseUpdateNotice = z.infer<typeof ReleaseUpdateNoticeSchema>;

export interface ReleaseCheckServiceConfig {
	owner: string;
	repo: string;
	currentVersion: string;
	storageKey: string;
	/**
	 * Called on every `checkForUpdates()` invocation. Returning `false` skips the
	 * network request entirely (and leaves `notice$` untouched). Use it to wire
	 * a user-facing toggle so disabled plugins never reach GitHub.
	 */
	isEnabled?: () => boolean;
}

export interface GitHubRelease {
	tag_name: string;
	html_url: string;
	published_at: string;
	draft: boolean;
	prerelease: boolean;
}
