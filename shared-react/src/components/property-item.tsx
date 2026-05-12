import { memo, type ReactNode } from "react";

import { useScopedCls } from "../contexts/theme-context";
import { PropertyValue } from "./property-value";

export interface PropertyItemProps {
	/** Label shown for the property key (left column). */
	keyLabel: ReactNode;
	/** Frontmatter value to render (right column). */
	value: unknown;
	/**
	 * Component scope appended after the active `cssPrefix`. The component
	 * emits four derived classes via `useScopedCls(scope)`:
	 *  - `cls("item")`  → `${cssPrefix}${scope}-item`  (row wrapper)
	 *  - `cls("key")`   → `${cssPrefix}${scope}-key`   (key cell)
	 *  - `cls("value")` → `${cssPrefix}${scope}-value` (value cell)
	 *  - `cls("value-link")` → `${cssPrefix}${scope}-value-link` (wiki-link anchors)
	 *
	 * @example
	 * <PropertyItem scope="event-preview-prop" ... />
	 * // → "prisma-event-preview-prop-item", etc.
	 */
	scope: string;
	/** Called after a link is opened — typically used to close the host modal. */
	onLinkClick?: (() => void) | undefined;
}

/**
 * Definition-list-style row that pairs a property key with its value rendered
 * via `<PropertyValue>`. Encapsulates the standard 3-div layout shared by
 * preview and notification modals so callers don't repeat the markup.
 *
 * `cssPrefix` and `app` are pulled from context (`SharedReactThemeProvider`
 * + `AppContext`) — both are wired automatically by every shared-react mount
 * bridge.
 */
export const PropertyItem = memo(function PropertyItem({ keyLabel, value, scope, onLinkClick }: PropertyItemProps) {
	const cls = useScopedCls(scope);
	return (
		<div className={cls("item")}>
			<div className={cls("key")}>{keyLabel}</div>
			<div className={cls("value")}>
				<PropertyValue value={value} linkClassName={cls("value-link")} onLinkClick={onLinkClick} />
			</div>
		</div>
	);
});
