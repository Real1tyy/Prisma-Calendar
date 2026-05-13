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
}

export interface GitHubRelease {
	tag_name: string;
	html_url: string;
	published_at: string;
	draft: boolean;
	prerelease: boolean;
}
