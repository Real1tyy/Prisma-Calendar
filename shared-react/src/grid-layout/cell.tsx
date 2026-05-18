import {
	Children,
	Fragment,
	isValidElement,
	memo,
	useEffect,
	useRef,
	type CSSProperties,
	type ReactElement,
	type ReactNode,
} from "react";

import { toKebabCase } from "../utils/kebab-case";
import type { CellCleanup, CellRender } from "./types";

/**
 * Declarative cell descriptor for `<GridLayout>`. Children of `<GridLayout>`
 * are walked at render time; each `<Cell>` contributes one palette entry plus
 * (unless `paletteOnly`) an initial placement.
 *
 * `<Cell>` itself never renders DOM — `<GridLayout>` extracts its props from
 * `React.Children` and renders the `children` ReactNode inside the cell `<div>`
 * directly. No `createRoot`, no `render(cellEl) => void` shim, no nested-root
 * cleanup hazard.
 */
export interface CellProps {
	/** Shown in the cell picker and the enlarge modal title. */
	label: string;
	/** Stable identity for persistence. Defaults to `kebab-case(label)`. */
	id?: string;
	/** Row index (0-based). Defaults to row-major fill from declaration order. */
	row?: number;
	/** Column index (0-based). Defaults to row-major fill from declaration order. */
	col?: number;
	rowSpan?: number;
	colSpan?: number;
	enlargeable?: boolean;
	enlargeTitle?: string;
	/** Palette-only: cell is available in the picker but not initially placed. */
	paletteOnly?: boolean;
	children: ReactNode;
}

const CELL_MARKER: unique symbol = Symbol.for("@real1ty-obsidian-plugins-react/grid-layout/Cell");

interface CellComponent {
	(props: CellProps): null;
	[CELL_MARKER]: true;
}

function CellImpl(_props: CellProps): null {
	return null;
}
(CellImpl as unknown as CellComponent)[CELL_MARKER] = true;

export const Cell = CellImpl as CellComponent;

/** Internal: shape extracted from a `<Cell>` element in `React.Children`. */
export interface CellChildSpec {
	id: string;
	label: string;
	row: number | undefined;
	col: number | undefined;
	rowSpan: number | undefined;
	colSpan: number | undefined;
	enlargeable: boolean | undefined;
	enlargeTitle: string | undefined;
	paletteOnly: boolean;
	children: ReactNode;
}

/**
 * Walk `<GridLayout>`'s children, extracting every `<Cell>`'s props in
 * declaration order. Recurses into Fragments so `<>...</>` works the same as
 * a flat list. Non-`<Cell>` children are ignored (so `{condition &&
 * <Cell .../>}` works naturally). Throws on duplicate IDs to fail fast.
 */
export function walkCellChildren(children: ReactNode): CellChildSpec[] {
	const specs: CellChildSpec[] = [];
	const seenIds = new Set<string>();

	function visit(node: ReactNode): void {
		Children.forEach(node, (child) => {
			if (!isValidElement(child)) return;
			if (child.type === Fragment) {
				visit((child.props as { children: ReactNode }).children);
				return;
			}
			const type = child.type as { [CELL_MARKER]?: true } | undefined;
			if (!type || type[CELL_MARKER] !== true) return;
			const props = child.props as CellProps;
			const id = props.id ?? toKebabCase(props.label);
			if (!id) {
				throw new Error(`<Cell> at index ${specs.length} has empty id (label was "${props.label}")`);
			}
			if (seenIds.has(id)) {
				throw new Error(`<Cell> id "${id}" appears more than once. Set explicit \`id\` props to disambiguate.`);
			}
			seenIds.add(id);
			specs.push({
				id,
				label: props.label,
				row: props.row,
				col: props.col,
				rowSpan: props.rowSpan,
				colSpan: props.colSpan,
				enlargeable: props.enlargeable,
				enlargeTitle: props.enlargeTitle,
				paletteOnly: props.paletteOnly === true,
				children: props.children,
			});
		});
	}

	visit(children);
	return specs;
}

/**
 * Mounts an imperative `CellRender` callback into a React-owned `<div>` and
 * runs `cleanup` on unmount or when the render reference changes. Isolates the
 * `render(cellEl) => void` contract to one React component so the engine's
 * cell `<div>` is always pure-React (cell content is a sibling subtree, not
 * imperative siblings of React-tracked nodes).
 *
 * Used by `<GridLayout>` when a placement comes from the legacy `cells={[]}`
 * array API or from `handle.setCell()`.
 */
export interface ImperativeCellHostProps {
	render: CellRender;
	cleanup?: CellCleanup | undefined;
	className?: string | undefined;
	style?: React.CSSProperties | undefined;
}

// The grid-cell parent is `display: flex; flex-direction: column`; the host must
// fill it so imperative content (FullCalendar with `height: "100%"`, Chart.js,
// heatmap canvases) gets a sized container. Without this, the host div collapses
// to 0×0 and the imperative content has nothing to size against.
const HOST_FILL_STYLE: CSSProperties = {
	flex: "1 1 auto",
	minWidth: 0,
	minHeight: 0,
	width: "100%",
	height: "100%",
};

export const ImperativeCellHost = memo(function ImperativeCellHost({
	render,
	cleanup,
	className,
	style,
}: ImperativeCellHostProps): ReactElement {
	const hostRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		void render(el);
		return () => {
			// Defer cleanup to a microtask. Consumer cleanups commonly call
			// root.unmount() on a nested React root (renderReactInline pattern).
			// Running that synchronously inside React's outer commit phase corrupts
			// the outer commit and produces "node to be removed is not a child of
			// this node" crashes. The microtask runs after the outer commit
			// finishes, so the nested unmount sees stable DOM. emptyElement runs
			// after cleanup so we don't race against nested-root teardown.
			const c = cleanup;
			queueMicrotask(() => {
				c?.();
				while (el.firstChild) el.removeChild(el.firstChild);
			});
		};
	}, [render, cleanup]);
	const mergedStyle = style ? { ...HOST_FILL_STYLE, ...style } : HOST_FILL_STYLE;
	return <div ref={hostRef} className={className} style={mergedStyle} />;
});
