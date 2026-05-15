import type { CSSProperties } from "react";
import { memo, useEffect, useRef } from "react";

export interface MountImperativeProps {
	/**
	 * Imperative renderer that mounts content into the provided host element.
	 *
	 * Called **once** for the lifetime of this component instance. Later prop
	 * changes to `render` are ignored by design — the mount-only contract is
	 * what makes this safe for engines that own their own DOM (FullCalendar,
	 * CodeMirror, Chart.js, Cytoscape, frappe-gantt).
	 *
	 * The `signal` is aborted when the component unmounts. Async renderers
	 * should bail out early if `signal.aborted` after every `await` to avoid
	 * mutating a detached host.
	 */
	render: (host: HTMLElement, signal: AbortSignal) => void | Promise<void>;

	/**
	 * Optional cleanup invoked when the host unmounts, before the host's
	 * children are removed. Like `render`, captured once at mount.
	 */
	cleanup?: (() => void) | undefined;

	/** `data-testid` applied to the host element. */
	testId?: string | undefined;
	className?: string | undefined;
	style?: CSSProperties | undefined;
}

/**
 * Bridge a React tree into imperative DOM rendering. Pass the imperative
 * mounting code via `render`; `MountImperative` provides the host element and
 * lifecycle hooks. Use this when wrapping engines that own their own DOM
 * (FullCalendar, frappe-gantt, Chart.js canvas, Cytoscape, CodeMirror).
 *
 * **Mount-only contract.** The `render` and `cleanup` props are captured on
 * first effect run and never re-invoked when those props change. This is what
 * keeps imperative engines from being torn down on every parent re-render.
 * Do not use this component for renderers that read live React state —
 * `host.textContent = someState` will not update.
 *
 * Prefer plain `useRef`/`useEffect` for one-off mounts; use this when the
 * mount can be expressed as a single render function the caller wants to
 * pass through props (e.g. as `TabDefinition.content`).
 */
export const MountImperative = memo(function MountImperative({
	render,
	cleanup,
	testId,
	className,
	style,
}: MountImperativeProps) {
	const ref = useRef<HTMLDivElement>(null);
	const initialRenderRef = useRef(render);
	const initialCleanupRef = useRef(cleanup);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const controller = new AbortController();
		const cleanupFn = initialCleanupRef.current;

		Promise.resolve(initialRenderRef.current(el, controller.signal)).catch((error: unknown) => {
			if (!controller.signal.aborted) {
				console.error("MountImperative render failed", error);
			}
		});

		return () => {
			controller.abort();
			try {
				cleanupFn?.();
			} finally {
				el.replaceChildren();
			}
		};
	}, []);

	return <div ref={ref} className={className} style={style} data-testid={testId} />;
});
