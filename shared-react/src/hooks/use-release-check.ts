import type { ReleaseCheckService, ReleaseUpdateNotice } from "@real1ty-obsidian-plugins";
import { useEffect } from "react";

import { useExternalSnapshot } from "./use-external-snapshot";

/**
 * React binding for `ReleaseCheckService`. Subscribes to the service's notice
 * stream and triggers a one-shot rate-limited check on mount (no-op when the
 * service has fetched within the last 24h).
 *
 * The hook intentionally does not own scheduling — the plugin's `main.ts`
 * still fires a startup check after `onLayoutReady`; the on-mount call here
 * is a safety net so the badge appears when the user opens settings on a
 * device where the startup window was missed (rare, but real for slow
 * machines or restored sessions).
 */
export function useReleaseCheck(service: ReleaseCheckService | null | undefined): ReleaseUpdateNotice | null {
	const notice = useExternalSnapshot(service?.notice$ ?? FALLBACK_NOTICE);

	useEffect(() => {
		if (!service) return;
		void service.checkForUpdates();
	}, [service]);

	return notice;
}

const FALLBACK_NOTICE = {
	subscribe: () => ({ unsubscribe: () => undefined }),
	getValue: () => null,
} as const;
