import { CommittedFilterInput, type CommittedFilterInputHandle } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";

import type { CalendarEvent } from "../../types/calendar";
import { createExpressionMatcher, matchesSearch } from "../../utils/filters/logic";
import { FilterPresetSelector } from "./filter-preset-selector";

const SEARCH_DEBOUNCE_MS = 300;
const EXPRESSION_DEBOUNCE_MS = 300;

export interface FilterBarHandle {
	shouldInclude: (event: CalendarEvent) => boolean;
}

interface FilterBarProps {
	onFilterChange: () => void;
	onHandleReady: (handle: FilterBarHandle) => void;
}

export const FilterBar = memo(function FilterBar({ onFilterChange, onHandleReady }: FilterBarProps) {
	const searchHandle = useRef<CommittedFilterInputHandle>(null);
	const expressionHandle = useRef<CommittedFilterInputHandle>(null);

	const matcher = useMemo(() => createExpressionMatcher(() => expressionHandle.current?.getValue() ?? ""), []);

	const onSearchCommit = useCallback(() => onFilterChange(), [onFilterChange]);

	const onExpressionCommit = useCallback(() => {
		matcher.invalidate();
		onFilterChange();
	}, [matcher, onFilterChange]);

	const onPresetSelected = useCallback((expression: string) => expressionHandle.current?.setValue(expression), []);

	useEffect(() => {
		onHandleReady({
			shouldInclude: (event: CalendarEvent) =>
				matchesSearch(searchHandle.current?.getValue() ?? "", { title: event.title }) && matcher.evaluate(event.meta),
		});
	}, [onHandleReady, matcher]);

	return (
		<div className="prisma-view-filter-bar" data-testid="prisma-filter-bar">
			<FilterPresetSelector onPresetSelected={onPresetSelected} />
			<CommittedFilterInput
				handleRef={expressionHandle}
				placeholder="Status === 'Done'"
				className="prisma-fc-expression-input"
				debounceMs={EXPRESSION_DEBOUNCE_MS}
				flushOnBlur
				testId="prisma-filter-expression"
				onCommit={onExpressionCommit}
			/>
			<CommittedFilterInput
				handleRef={searchHandle}
				placeholder="Search events..."
				className="prisma-fc-search-input"
				debounceMs={SEARCH_DEBOUNCE_MS}
				flushOnBlur
				testId="prisma-filter-search"
				onCommit={onSearchCommit}
			/>
		</div>
	);
});
