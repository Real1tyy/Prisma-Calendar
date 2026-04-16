import { createCssUtils } from "../../utils/css-utils";
import { injectStyleSheet } from "../../utils/styles/inject";

// ─── Types ───

export interface CollapsibleSectionConfig {
	/** CSS prefix for all class names (e.g. "prisma-") */
	cssPrefix: string;
	/** Label text displayed in the header */
	label: string;
	/** Render callback for the body content */
	renderBody: (body: HTMLElement) => void;
	/** Whether the section starts collapsed (default: false) */
	startCollapsed?: boolean;
	/** Optional external state map — persists collapsed state by label across re-renders */
	stateMap?: Map<string, boolean>;
	/** Optional extra elements to render in the header (e.g. action buttons). Rendered after the label, pushed right via flex. */
	renderHeaderActions?: (header: HTMLElement) => void;
}

export interface CollapsibleSectionHandle {
	/** The root section element */
	el: HTMLElement;
	/** Expand the section */
	expand: () => void;
	/** Collapse the section */
	collapse: () => void;
	/** Toggle the section */
	toggle: () => void;
	/** Whether the section is currently collapsed */
	isCollapsed: () => boolean;
}

// ─── CSS Suffixes ───

const SECTION_SUFFIX = "collapsible";
const HEADER_SUFFIX = "collapsible-header";
const TOGGLE_SUFFIX = "collapsible-toggle";
const LABEL_SUFFIX = "collapsible-label";
const BODY_SUFFIX = "collapsible-body";
const HIDDEN_SUFFIX = "collapsible-hidden";

// ─── Styles ───

export function buildCollapsibleStyles(p: string): string {
	return `
.${p}${SECTION_SUFFIX} {
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	overflow: hidden;
}

.${p}${HEADER_SUFFIX} {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: var(--background-secondary);
	cursor: pointer;
	user-select: none;
	transition: background-color 0.15s ease;
}

.${p}${HEADER_SUFFIX}:hover {
	background: var(--background-modifier-hover);
}

.${p}${TOGGLE_SUFFIX} {
	font-size: 10px;
	color: var(--text-muted);
	width: 12px;
	text-align: center;
	flex-shrink: 0;
}

.${p}${LABEL_SUFFIX} {
	font-weight: 600;
	color: var(--text-normal);
}

.${p}${BODY_SUFFIX} {
	padding: 12px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.${p}${BODY_SUFFIX}.${p}${HIDDEN_SUFFIX} {
	display: none;
}
`;
}

// ─── Component ───

export function renderCollapsibleSection(
	container: HTMLElement,
	config: CollapsibleSectionConfig
): CollapsibleSectionHandle {
	const { cssPrefix, label, renderBody, startCollapsed = false, stateMap, renderHeaderActions } = config;

	const css = createCssUtils(cssPrefix);
	injectStyleSheet(`${cssPrefix}collapsible-styles`, buildCollapsibleStyles(cssPrefix));

	let collapsed = stateMap?.get(label) ?? startCollapsed;

	const section = container.createDiv({ cls: css.cls(SECTION_SUFFIX) });
	const header = section.createDiv({ cls: css.cls(HEADER_SUFFIX) });
	const toggleIcon = header.createSpan({ cls: css.cls(TOGGLE_SUFFIX), text: collapsed ? "▶" : "▼" });
	header.createSpan({ cls: css.cls(LABEL_SUFFIX), text: label });

	if (renderHeaderActions) {
		renderHeaderActions(header);
	}

	const body = section.createDiv({ cls: css.cls(BODY_SUFFIX) });
	if (collapsed) css.addCls(body, HIDDEN_SUFFIX);
	renderBody(body);

	function setCollapsed(value: boolean): void {
		collapsed = value;
		if (collapsed) {
			css.addCls(body, HIDDEN_SUFFIX);
		} else {
			css.removeCls(body, HIDDEN_SUFFIX);
		}
		toggleIcon.setText(collapsed ? "▶" : "▼");
		stateMap?.set(label, collapsed);
	}

	header.addEventListener("click", () => setCollapsed(!collapsed));

	return {
		el: section,
		expand: () => setCollapsed(false),
		collapse: () => setCollapsed(true),
		toggle: () => setCollapsed(!collapsed),
		isCollapsed: () => collapsed,
	};
}
