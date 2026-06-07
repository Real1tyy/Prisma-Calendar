import { memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { useCls } from "../contexts/theme-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { OutboundLink } from "../primitives/atoms/outbound-link";
import { cx } from "../utils/cx";
import { buildSettingsNavStyles } from "./settings-nav.styles";

export interface SettingsNavTab {
	id: string;
	label: string;
	icon?: string;
	badge?: string | number;
	visible?: boolean;
}

export interface SettingsFooterLink {
	text: string;
	href: string;
}

export interface SettingsNavProps {
	tabs: SettingsNavTab[];
	activeId: string;
	onChange: (id: string) => void;
	searchValue?: string;
	onSearchChange?: (value: string) => void;
	footerLinks?: SettingsFooterLink[];
	children?: ReactNode;
}

export const SettingsNav = memo(function SettingsNav({
	tabs,
	activeId,
	onChange,
	searchValue = "",
	onSearchChange,
	footerLinks,
	children,
}: SettingsNavProps) {
	const cls = useCls();
	const { cls: settingsCls, tid } = useScopedStyles("settings", buildSettingsNavStyles);
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const [noResults, setNoResults] = useState(false);
	const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
	const rootRef = useRef<HTMLDivElement>(null);

	const isSearching = searchValue.trim().length >= 2;

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;

		const HIDDEN = settingsCls("search-hidden");
		const FOOTER = settingsCls("footer");

		if (!isSearching) {
			root.querySelectorAll(`.${HIDDEN}`).forEach((el) => el.classList.remove(HIDDEN));
			setNoResults(false);
			return;
		}

		const q = searchValue.trim().toLowerCase();
		let visible = 0;
		root.querySelectorAll<HTMLElement>(`.setting-item:not(.${FOOTER})`).forEach((el) => {
			const match = el.textContent.toLowerCase().includes(q);
			el.classList.toggle(HIDDEN, !match);
			if (match) visible++;
		});
		setNoResults(visible === 0);
	}, [searchValue, isSearching, settingsCls]);

	const visibleTabs = tabs.filter((tab) => tab.visible !== false);

	const handleTabClick = useCallback(
		(id: string) => {
			if (onSearchChange) onSearchChange("");
			onChange(id);
		},
		[onChange, onSearchChange]
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "ArrowDown" || e.key === "ArrowRight") {
				e.preventDefault();
				const next = (focusedIndex + 1) % visibleTabs.length;
				setFocusedIndex(next);
				buttonsRef.current[next]?.focus();
			} else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
				e.preventDefault();
				const prev = (focusedIndex - 1 + visibleTabs.length) % visibleTabs.length;
				setFocusedIndex(prev);
				buttonsRef.current[prev]?.focus();
			} else if (e.key === "Enter" && focusedIndex >= 0) {
				if ((e.target as HTMLElement).tagName === "INPUT") return;
				e.preventDefault();
				handleTabClick(visibleTabs[focusedIndex].id);
			}
		},
		[focusedIndex, visibleTabs, handleTabClick]
	);

	return (
		<div ref={rootRef}>
			<nav className={settingsCls("nav")} role="tablist" aria-label="Settings navigation">
				<div className={cls("nav-buttons")} onKeyDown={handleKeyDown}>
					{visibleTabs.map((tab, index) => {
						const isActive = !searchValue && tab.id === activeId;
						return (
							<button
								key={tab.id}
								ref={(el) => {
									buttonsRef.current[index] = el;
								}}
								type="button"
								role="tab"
								aria-selected={isActive}
								className={cx(isActive && cls("active"))}
								onClick={() => handleTabClick(tab.id)}
								onFocus={() => setFocusedIndex(index)}
								data-testid={tid("nav", tab.id)}
							>
								{tab.label}
								{tab.badge !== undefined && <span className={settingsCls("nav-badge")}>{tab.badge}</span>}
							</button>
						);
					})}

					{onSearchChange && (
						<div className={settingsCls("search")}>
							<input
								type="text"
								className={settingsCls("search-input")}
								placeholder="Search settings..."
								value={searchValue}
								onChange={(e) => onSearchChange(e.target.value)}
								data-testid={tid("search")}
							/>
						</div>
					)}
				</div>
			</nav>

			{isSearching && noResults && (
				<div className={settingsCls("search-no-results")}>No settings found for &quot;{searchValue}&quot;</div>
			)}

			{children}

			{footerLinks && footerLinks.length > 0 && (
				<div className={`setting-item ${settingsCls("footer")}`}>
					<div className={settingsCls("footer-links")}>
						{footerLinks.map((link) => (
							<OutboundLink key={link.href} href={link.href} className={settingsCls("support-link")}>
								{link.text}
							</OutboundLink>
						))}
					</div>
				</div>
			)}
		</div>
	);
});
