import { useObservable } from "@real1ty-obsidian-plugins-react";
import { memo, useEffect, useRef } from "react";
import type { Observable } from "rxjs";

import { cls, tid } from "../../constants";

export const INITIAL_INDEXING_TEXT = "Indexing calendar events…";
export const REINDEXING_TEXT = "Re-indexing calendar events…";

interface IndexingOverlayProps {
	indexingComplete$: Observable<boolean>;
}

/**
 * Full-bleed overlay shown over the calendar while events are being indexed.
 * Stacks above the grid (see `_indexing-overlay.scss`) so the spinner is
 * impossible to miss, unlike the old inline loader that scrolled off the bottom.
 */
export const IndexingOverlay = memo(function IndexingOverlay({ indexingComplete$ }: IndexingOverlayProps) {
	const isComplete = useObservable(indexingComplete$, false);
	const hasCompletedOnce = useRef(false);

	useEffect(() => {
		if (isComplete) hasCompletedOnce.current = true;
	}, [isComplete]);

	if (isComplete) return null;

	const text = hasCompletedOnce.current ? REINDEXING_TEXT : INITIAL_INDEXING_TEXT;

	return (
		<div className={cls("indexing-overlay")} data-testid={tid("indexing-overlay")} role="status" aria-live="polite">
			<div className={cls("indexing-overlay-spinner")} aria-hidden="true" />
			<div className={cls("indexing-overlay-text")}>{text}</div>
		</div>
	);
});
