import { filterVersions, type VersionSection } from "@real1ty/obsidian-plugins";
import { memo, useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { useScoped } from "../contexts/theme-context";

interface VersionNavigatorProps {
	/** Newest first, as the changelog lists them. */
	sections: readonly VersionSection[];
	index: number;
	onSelect: (index: number) => void;
}

/**
 * Newer on the left, older on the right — the newest release is the far-left
 * end, so there is nothing further left to go to from it. The version box in
 * the middle doubles as a search: focus it, type part of a version, and pick
 * from the filtered list (Enter takes the highlighted match).
 */
export const VersionNavigator = memo(function VersionNavigator({ sections, index, onSelect }: VersionNavigatorProps) {
	const { cls, tid } = useScoped("whats-new");
	const [query, setQuery] = useState<string | null>(null);
	const [highlight, setHighlight] = useState(0);

	const isOpen = query !== null;
	const matches = useMemo(() => (isOpen ? filterVersions(sections, query) : []), [isOpen, query, sections]);
	const current = sections.at(index);

	const close = useCallback(() => {
		setQuery(null);
		setHighlight(0);
	}, []);

	const select = useCallback(
		(version: string) => {
			const target = sections.findIndex((section) => section.version === version);
			if (target >= 0) onSelect(target);
			close();
		},
		[sections, onSelect, close]
	);

	const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setQuery(e.target.value);
		setHighlight(0);
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setHighlight((h) => Math.max(h - 1, 0));
			} else if (e.key === "Enter") {
				e.preventDefault();
				const match = matches.at(highlight);
				if (match !== undefined) select(match.version);
				e.currentTarget.blur();
			}
		},
		[matches, highlight, select]
	);

	const goNewer = useCallback(() => onSelect(index - 1), [onSelect, index]);
	const goOlder = useCallback(() => onSelect(index + 1), [onSelect, index]);

	if (current === undefined) return null;

	return (
		<div className={cls("nav")} data-testid={tid("nav")}>
			<button
				type="button"
				className={cls("nav-arrow")}
				onClick={goNewer}
				disabled={index === 0}
				aria-label="Newer version"
				title="Newer version"
				data-testid={tid("nav-newer")}
			>
				‹
			</button>
			<div className={cls("picker")}>
				<div className={cls("picker-field")}>
					<input
						type="text"
						className={cls("picker-input")}
						value={query ?? `v${current.version}`}
						placeholder="Search versions"
						aria-label="Version"
						role="combobox"
						aria-expanded={isOpen}
						aria-autocomplete="list"
						onFocus={() => setQuery("")}
						onBlur={close}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						data-testid={tid("version-input")}
					/>
					{isOpen && (
						<ul className={cls("picker-list")} role="listbox" data-testid={tid("version-list")}>
							{matches.length === 0 ? (
								<li className={cls("picker-empty")}>No matching version</li>
							) : (
								matches.map((section, i) => (
									<li
										key={section.version}
										role="option"
										aria-selected={i === highlight}
										className={`${cls("picker-option")}${i === highlight ? ` ${cls("picker-option-active")}` : ""}`}
										// mousedown, not click: the input's blur closes the list before a click lands.
										onMouseDown={(e) => {
											e.preventDefault();
											select(section.version);
										}}
										data-testid={tid(`version-option-${section.version}`)}
									>
										v{section.version}
									</li>
								))
							)}
						</ul>
					)}
				</div>
				<span className={cls("nav-position")} data-testid={tid("nav-position")}>
					{index + 1} of {sections.length}
				</span>
			</div>
			<button
				type="button"
				className={cls("nav-arrow")}
				onClick={goOlder}
				disabled={index === sections.length - 1}
				aria-label="Older version"
				title="Older version"
				data-testid={tid("nav-older")}
			>
				›
			</button>
		</div>
	);
});
