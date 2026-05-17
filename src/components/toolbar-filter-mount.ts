import {
	CommittedFilterInput,
	type CommittedFilterInputHandle,
	renderReactInline,
} from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { createElement, createRef } from "react";

import { cls } from "../constants";
import { CSS_PREFIX } from "../constants";
import type { Frontmatter } from "../types";
import { createExpressionMatcher, matchesSearch } from "../utils/filters/logic";

const SEARCH_DEBOUNCE_MS = 300;
const EXPRESSION_DEBOUNCE_MS = 300;
const SEARCH_PLACEHOLDER = "Search events...";
const EXPRESSION_PLACEHOLDER = "Status === 'Done'";
const SEARCH_TEST_ID = `${CSS_PREFIX}filter-search`;
const EXPRESSION_TEST_ID = `${CSS_PREFIX}filter-expression`;

export interface ToolbarFilterHandle {
	focus: () => void;
	isFocused: () => boolean;
	setFilterValue: (value: string) => void;
	getCurrentFilterValue: () => string;
	shouldInclude: (data: { meta?: Frontmatter; title?: string }) => boolean;
	destroy: () => void;
}

interface MountOptions {
	app: App;
	container: HTMLElement;
	onFilterChange: () => void;
}

interface InternalMountOptions extends MountOptions {
	placeholder: string;
	inputClassName: string;
	testId: string;
	debounceMs: number;
	predicate: (currentValue: string, data: { meta?: Frontmatter; title?: string }) => boolean;
	onCommitExtra?: (newValue: string) => void;
}

/**
 * The `.prisma-fc-filter-wrapper` element MUST be a direct child of
 * `.fc-toolbar-chunk` — the FullCalendar toolbar uses flexbox and
 * `_fullcalendar-3.scss` mobile rules style the wrapper as a flex item
 * (`flex: 1 1 100%`) and as a collapse target. Mounting React into a
 * placeholder slot would insert an extra wrapper that breaks both.
 * Instead the wrapper itself is the mount root, so the DOM is identical
 * to the imperative version: `.fc-toolbar-chunk > .prisma-fc-filter-wrapper > input`.
 */
function injectFilterWrapper(container: HTMLElement): HTMLElement | null {
	const toolbarLeft = container.querySelector(".fc-toolbar-chunk:first-child");
	if (!toolbarLeft) return null;

	const wrapper = activeDocument.createElement("div");
	wrapper.className = cls("fc-filter-wrapper");

	const zoomButton = toolbarLeft.querySelector(".fc-zoomLevel-button");
	if (zoomButton?.parentNode) {
		zoomButton.parentNode.insertBefore(wrapper, zoomButton.nextSibling);
	} else {
		toolbarLeft.appendChild(wrapper);
	}

	return wrapper;
}

function mountFilter(opts: InternalMountOptions): ToolbarFilterHandle {
	let currentValue = "";
	const handleRef = createRef<CommittedFilterInputHandle>();

	const handleCommit = (newValue: string) => {
		currentValue = newValue;
		opts.onCommitExtra?.(newValue);
		opts.onFilterChange();
	};

	const wrapperEl = injectFilterWrapper(opts.container);
	const unmountReact = wrapperEl
		? renderReactInline(
				wrapperEl,
				createElement(CommittedFilterInput, {
					placeholder: opts.placeholder,
					className: opts.inputClassName,
					debounceMs: opts.debounceMs,
					testId: opts.testId,
					flushOnBlur: true,
					onCommit: handleCommit,
					handleRef,
				}),
				opts.app,
				{ cssPrefix: CSS_PREFIX, testIdPrefix: CSS_PREFIX }
			)
		: null;

	return {
		focus: () => handleRef.current?.focus(),
		isFocused: () => handleRef.current?.isFocused() ?? false,
		setFilterValue: (value: string) => {
			handleRef.current?.setValue(value);
		},
		getCurrentFilterValue: () => currentValue,
		shouldInclude: (data) => opts.predicate(currentValue, data),
		destroy: () => {
			unmountReact?.();
			wrapperEl?.parentElement?.removeChild(wrapperEl);
		},
	};
}

export function mountSearchFilter(opts: MountOptions): ToolbarFilterHandle {
	return mountFilter({
		...opts,
		placeholder: SEARCH_PLACEHOLDER,
		inputClassName: cls("fc-search-input"),
		testId: SEARCH_TEST_ID,
		debounceMs: SEARCH_DEBOUNCE_MS,
		predicate: (current, data) => matchesSearch(current, data),
	});
}

export function mountExpressionFilter(opts: MountOptions): ToolbarFilterHandle {
	let getCurrent = () => "";
	const matcher = createExpressionMatcher(() => getCurrent());
	const handle = mountFilter({
		...opts,
		placeholder: EXPRESSION_PLACEHOLDER,
		inputClassName: cls("fc-expression-input"),
		testId: EXPRESSION_TEST_ID,
		debounceMs: EXPRESSION_DEBOUNCE_MS,
		predicate: (_current, data) => matcher.evaluate(data.meta ?? {}),
		onCommitExtra: () => matcher.invalidate(),
	});
	getCurrent = () => handle.getCurrentFilterValue();
	return handle;
}
