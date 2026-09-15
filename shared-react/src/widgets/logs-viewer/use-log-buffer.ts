import type { LogEntry, LogService } from "@real1ty/obsidian-plugins";
import { useCallback, useMemo, useState } from "react";
import { asyncScheduler, throttleTime } from "rxjs";

import { useSubscription } from "../../hooks/reactive/use-observable";

/** Quiet window a burst of appends is coalesced into before the table redraws. */
const BATCH_MS = 150;

export interface LogBufferState {
	/** Newest first — the order the table renders. */
	entries: LogEntry[];
	/** Appends withheld because the user is reading further down the list. */
	pending: number;
	/** Adopt the buffer as it stands now and clear `pending`. */
	adopt: () => void;
}

function newestFirst(service: LogService): LogEntry[] {
	return service.snapshot().reverse();
}

/**
 * The live half of the logs viewer: the in-memory buffer, bridged into React.
 *
 * `follow` is what makes new entries safe to show. While the user sits at the
 * top they are adopted as they arrive; the moment the user scrolls down to read
 * something, appends are counted instead of applied — prepending rows to a
 * newest-first list would slide the row they are reading out from under the
 * cursor. `adopt` is the "N new entries" button that ends the hold.
 */
export function useLogBuffer(service: LogService, follow: boolean): LogBufferState {
	const [entries, setEntries] = useState<LogEntry[]>(() => newestFirst(service));
	const [pending, setPending] = useState(0);

	const adopt = useCallback(() => {
		setEntries(newestFirst(service));
		setPending(0);
	}, [service]);

	// One re-copy of the buffer per quiet window, not one per entry: a scan that
	// logs a thousand notes must not schedule a thousand table redraws.
	const batched$ = useMemo(
		() => service.changes$.pipe(throttleTime(BATCH_MS, asyncScheduler, { leading: true, trailing: true })),
		[service]
	);
	// `useSubscription` re-reads its callback every render, so both closures see
	// the current `follow` without a re-subscription or a mirroring ref.
	useSubscription(batched$, () => {
		if (follow) adopt();
	});

	useSubscription(service.changes$, (change) => {
		// A clear is not an append to hold back — there is nothing left to read.
		if (change.type === "clear") adopt();
		else if (!follow) setPending((count) => count + 1);
	});

	return { entries, pending, adopt };
}
