import { memo, useRef } from "react";
import { createPortal } from "react-dom";

import { useOutsideClick } from "../../hooks/dom/use-outside-click";
import { useEscapeKey } from "../../hooks/keyboard/use-trigger-keys";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { appearanceStyle, type Appearance } from "../../utils/appearance";
import type { TabDefinition } from "./types";

export interface GroupDropdownProps {
	groupId: string;
	cssPrefix: string;
	testIdPrefix: string;
	position: { x: number; y: number };
	items: TabDefinition[];
	getChildLabel: (child: TabDefinition) => string;
	getChildAppearance?: (child: TabDefinition) => Appearance;
	onSelect: (childId: string) => void;
	onDismiss: () => void;
	hoverDropdown: boolean;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
}

export const GroupDropdown = memo(function GroupDropdown({
	groupId,
	cssPrefix,
	testIdPrefix,
	position,
	items,
	getChildLabel,
	getChildAppearance,
	onSelect,
	onDismiss,
	hoverDropdown,
	onMouseEnter,
	onMouseLeave,
}: GroupDropdownProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEscapeKey(onDismiss);

	useOutsideClick([ref], onDismiss);

	return createPortal(
		<div
			ref={ref}
			className={`${cssPrefix}tab-group-dropdown`}
			style={{ left: position.x, top: position.y }}
			role="menu"
			data-testid={`${testIdPrefix}tab-group-dropdown-${groupId}`}
			onMouseEnter={hoverDropdown ? onMouseEnter : undefined}
			onMouseLeave={hoverDropdown ? onMouseLeave : undefined}
		>
			{items.map((child) => {
				const appearance = getChildAppearance?.(child) ?? {};
				return (
					<button
						key={child.id}
						type="button"
						role="menuitem"
						className={`${cssPrefix}tab-group-dropdown-item`}
						data-testid={`${testIdPrefix}view-tab-${child.id}`}
						style={appearanceStyle(appearance, "backgroundColor")}
						onClick={() => {
							onSelect(child.id);
						}}
					>
						{appearance.icon && (
							<span className={`${cssPrefix}tab-icon`} style={appearanceStyle(appearance, "color")}>
								<ObsidianIcon icon={appearance.icon} />
							</span>
						)}
						<span style={appearanceStyle(appearance, "textColor")}>{getChildLabel(child)}</span>
					</button>
				);
			})}
		</div>,
		activeDocument.body
	);
});
