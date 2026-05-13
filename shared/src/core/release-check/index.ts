export { compareVersions, parseVersion } from "./compare-versions";
export {
	RELEASE_CHECK_INTERVAL_MS,
	ReleaseCheckService,
	type ReleaseCheckServiceOptions,
} from "./release-check-service";
export type { GitHubRelease, ReleaseCheckServiceConfig, ReleaseUpdateNotice } from "./types";
export { ReleaseUpdateNoticeSchema } from "./types";
