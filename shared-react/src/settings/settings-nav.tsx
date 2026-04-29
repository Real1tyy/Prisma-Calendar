import type { KeyboardEvent, ReactNode } from "react";
import { memo, useCallback, useRef, useState } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";

function buildSettingsNavStyles(p: string): string {
	return `
.${p}settings-nav {
	margin-bottom: 24px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 16px;
}
.${p}nav-buttons { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.${p}nav-buttons button {
	padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background-color: var(--background-secondary); color: var(--text-normal); cursor: pointer;
	font-size: var(--font-ui-small); transition: all 0.2s ease;
}
.${p}nav-buttons button.${p}active {
	background-color: var(--interactive-accent); color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}
.${p}nav-buttons button:hover:not(.${p}active) { background-color: var(--background-modifier-hover); }
.${p}settings-nav-badge {
	margin-left: 6px; padding: 1px 6px; font-size: 0.75em; border-radius: 10px;
	background: var(--background-modifier-hover); color: var(--text-muted);
}
.${p}settings-search { margin-left: auto; flex-shrink: 0; }
.${p}settings-search-input {
	padding: 6px 10px; border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background-color: var(--background-secondary); color: var(--text-normal);
	font-size: var(--font-ui-small); width: 150px; transition: width 0.2s ease;
}
.${p}settings-search-input:focus {
	border-color: var(--interactive-accent);
	box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2); width: 200px;
}
.${p}settings-footer { margin-top: 2rem; text-align: center; font-size: var(--font-ui-smaller); color: var(--text-faint); }
.${p}settings-footer-links { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
.${p}settings-support-link { text-decoration: none; color: var(--text-accent); }
.${p}settings-support-link:hover { text-decoration: underline; }
`;
}

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
	cssPrefix?: string;
	children?: ReactNode;
}

export const SettingsNav = memo(function SettingsNav({
	tabs,
	activeId,
	onChange,
	searchValue = "",
	onSearchChange,
	footerLinks,
	cssPrefix = "",
	children,
}: SettingsNavProps) {
	useInjectedStyles(`${cssPrefix}settings-nav-styles`, buildSettingsNavStyles(cssPrefix));
	const [focusedIndex, setFocusedIndex] = useState(-1);
	const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

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
		<div>
			<nav className={`${cssPrefix}settings-nav`} role="tablist" aria-label="Settings navigation">
				<div className={`${cssPrefix}nav-buttons`} onKeyDown={handleKeyDown}>
					{visibleTabs.map((tab, index) => {
						const isActive = !searchValue && tab.id === activeId;
						const className = [isActive ? `${cssPrefix}active` : ""].filter(Boolean).join(" ") || undefined;

						return (
							<button
								key={tab.id}
								ref={(el) => {
									buttonsRef.current[index] = el;
								}}
								type="button"
								role="tab"
								aria-selected={isActive}
								className={className}
								onClick={() => handleTabClick(tab.id)}
								onFocus={() => setFocusedIndex(index)}
								data-testid={`${cssPrefix}settings-nav-${tab.id}`}
							>
								{tab.label}
								{tab.badge !== undefined && <span className={`${cssPrefix}settings-nav-badge`}>{tab.badge}</span>}
							</button>
						);
					})}

					{onSearchChange && (
						<div className={`${cssPrefix}settings-search`}>
							<input
								type="text"
								className={`${cssPrefix}settings-search-input`}
								placeholder="Search settings..."
								value={searchValue}
								onChange={(e) => onSearchChange(e.target.value)}
								data-testid={`${cssPrefix}settings-search`}
							/>
						</div>
					)}
				</div>
			</nav>

			{children}

			{footerLinks && footerLinks.length > 0 && (
				<div className={`setting-item ${cssPrefix}settings-footer`}>
					<div className={`${cssPrefix}settings-footer-links`}>
						{footerLinks.map((link) => (
							<a key={link.href} href={link.href} className={`${cssPrefix}settings-support-link`}>
								{link.text}
							</a>
						))}
					</div>
				</div>
			)}
		</div>
	);
});
