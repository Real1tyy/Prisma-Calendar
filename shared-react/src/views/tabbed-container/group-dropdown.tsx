import { memo, useRef } from "react";
import { createPortal } from "react-dom";

import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { useOutsideClick } from "../../hooks/dom/use-outside-click";
import { useEscapeKey } from "../../hooks/keyboard/use-trigger-keys";
import type { TabDefinition } from "./types";

export interface GroupDropdownProps {
	groupId: string;
	cssPrefix: string;
	testIdPrefix: string;
	position: { x: number; y: number };
	children: TabDefinition[];
	getChildLabel: (child: TabDefinition) => string;
	getChildIcon?: (child: TabDefinition) => string | undefined;
	getChildColor?: (child: TabDefinition) => string | undefined;
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
	children,
	getChildLabel,
	getChildIcon,
	getChildColor,
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
			{children.map((child) => {
				const icon = getChildIcon?.(child);
				const color = getChildColor?.(child);
				return (
					<button
						key={child.id}
						type="button"
						role="menuitem"
						className={`${cssPrefix}tab-group-dropdown-item`}
						data-testid={`${testIdPrefix}view-tab-${child.id}`}
						onClick={() => {
							onSelect(child.id);
						}}
					>
						{icon && (
							<span className={`${cssPrefix}tab-icon`} style={color ? { color } : undefined}>
								<ObsidianIcon icon={icon} />
							</span>
						)}
						<span>{getChildLabel(child)}</span>
					</button>
				);
			})}
		</div>,
		document.body
	);
});
