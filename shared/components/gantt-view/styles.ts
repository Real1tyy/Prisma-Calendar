import { injectStyleSheet } from "../../utils/styles/inject";

function buildGanttStyles(p: string): string {
	return `
.${p}gantt-wrapper {
	display: flex;
	flex-direction: column;
	flex: 1 1 0;
	min-height: 400px;
	position: relative;
	overflow: hidden;
}

.${p}gantt-toolbar {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	gap: 1rem;
	padding: 6px 8px;
	border-bottom: 1px solid var(--background-modifier-border);
	flex-shrink: 0;
	overflow: hidden;
}

.${p}gantt-toolbar-left {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	gap: 1rem;
	flex: 1 1 0;
	min-width: 0;
	overflow: hidden;
}

.${p}gantt-toolbar-right {
	display: flex;
	flex-wrap: nowrap;
	align-items: center;
	gap: 1rem;
	flex-shrink: 0;
}



.${p}gantt-nav {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.${p}gantt-nav-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	min-width: 28px;
	height: 28px;
	padding: 0 6px;
	border: none;
	border-radius: var(--radius-s);
	background: none;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	cursor: pointer;
}

.${p}gantt-nav-btn:hover {
	color: var(--text-normal);
	background: var(--background-modifier-hover);
}

.${p}gantt-today-btn {
	font-weight: 600;
	color: var(--text-normal);
}

.${p}gantt-header-wrapper {
	position: sticky;
	top: 0;
	z-index: 2;
	overflow: hidden;
	background: var(--background-primary);
	border-bottom: 1px solid var(--background-modifier-border);
}

.${p}gantt-header {
	position: relative;
	height: 50px;
}

.${p}gantt-month-label {
	position: absolute;
	top: 4px;
	transform: translateX(-50%);
	font-size: var(--font-ui-small);
	font-weight: 600;
	color: var(--text-muted);
	white-space: nowrap;
}

.${p}gantt-day-tick {
	position: absolute;
	bottom: 4px;
	text-align: center;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	box-sizing: border-box;
}

.${p}gantt-body {
	overflow: hidden;
	overflow-y: auto;
	flex: 1 1 0;
	position: relative;
	cursor: grab;
}

.${p}gantt-grid-svg {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 1;
	pointer-events: none;
}

.${p}gantt-arrow-svg {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 1;
	pointer-events: none;
}

.${p}gantt-row-alt {
	fill: var(--background-secondary-alt);
	opacity: 0.3;
}

.${p}gantt-grid-line {
	stroke: var(--background-modifier-border);
	stroke-width: 1;
	pointer-events: none;
}

.${p}gantt-today-line {
	stroke: var(--color-accent);
	stroke-width: 2;
	stroke-dasharray: 4 2;
	pointer-events: none;
}

.${p}gantt-bar-layer {
	position: relative;
	z-index: 2;
}

.${p}gantt-bar {
	position: absolute;
	background-color: var(--interactive-accent);
	border-radius: var(--radius-s);
	cursor: pointer;
	display: flex;
	align-items: center;
	min-height: 40px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	transition: filter 0.15s ease;
}

.${p}gantt-bar:hover {
	filter: brightness(1.1);
}

.${p}gantt-bar-label {
	padding: 4px 8px;
	font-size: var(--font-ui-small);
	color: var(--text-on-accent);
	line-height: 1.3;
	word-break: break-word;
	overflow-wrap: break-word;
}

.${p}gantt-arrow-group {
	pointer-events: stroke;
	cursor: pointer;
}

.${p}gantt-arrow-group:hover .${p}gantt-arrow {
	stroke: var(--text-normal);
	stroke-width: 2.5;
}

.${p}gantt-arrow-hit {
	fill: none;
	stroke: transparent;
	stroke-width: 12;
	pointer-events: stroke;
}

.${p}gantt-arrow {
	fill: none;
	stroke: var(--text-muted);
	stroke-width: 1.5;
	pointer-events: none;
}

.${p}gantt-arrowhead {
	fill: var(--text-muted);
}
`;
}

export function injectGanttStyles(prefix: string): void {
	injectStyleSheet(`${prefix}gantt-styles`, buildGanttStyles(prefix));
}
