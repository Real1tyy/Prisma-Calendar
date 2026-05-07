import { FilterInput } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { createExpressionMatcher, matchesSearch } from "../../utils/filter-logic";
import { FilterPresetSelector } from "./filter-preset-selector";

const SEARCH_DEBOUNCE_MS = 150;
const EXPRESSION_DEBOUNCE_MS = 50;

export interface FilterBarHandle {
	shouldInclude: (event: CalendarEvent) => boolean;
}

interface FilterBarProps {
	bundle: CalendarBundle;
	onFilterChange: () => void;
	onHandleReady: (handle: FilterBarHandle) => void;
}

export const FilterBar = memo(function FilterBar({ bundle, onFilterChange, onHandleReady }: FilterBarProps) {
	const [searchValue, setSearchValue] = useState("");
	const [expressionValue, setExpressionValue] = useState("");

	const committedSearch = useRef("");
	const committedExpression = useRef("");

	const matcher = useMemo(() => createExpressionMatcher(() => committedExpression.current), []);

	const commitSearch = useCallback(
		(v: string) => {
			setSearchValue(v);
			if (v === committedSearch.current) return;
			committedSearch.current = v;
			onFilterChange();
		},
		[onFilterChange]
	);

	const commitExpression = useCallback(
		(v: string) => {
			setExpressionValue(v);
			if (v === committedExpression.current) return;
			committedExpression.current = v;
			matcher.invalidate();
			onFilterChange();
		},
		[onFilterChange, matcher]
	);

	useEffect(() => {
		onHandleReady({
			shouldInclude: (event: CalendarEvent) =>
				matchesSearch(committedSearch.current, { title: event.title }) && matcher.evaluate(event.meta ?? {}),
		});
	}, [onHandleReady, matcher]);

	return (
		<div className="prisma-view-filter-bar" data-testid="prisma-filter-bar">
			<FilterPresetSelector bundle={bundle} onPresetSelected={commitExpression} />
			<FilterInput
				value={expressionValue}
				onChange={commitExpression}
				placeholder="Status === 'Done'"
				className="prisma-fc-expression-input"
				debounceMs={EXPRESSION_DEBOUNCE_MS}
				testId="prisma-filter-expression"
			/>
			<FilterInput
				value={searchValue}
				onChange={commitSearch}
				placeholder="Search events..."
				className="prisma-fc-search-input"
				debounceMs={SEARCH_DEBOUNCE_MS}
				testId="prisma-filter-search"
			/>
		</div>
	);
});
