import { memo, useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { SharedReactThemeProvider } from "../contexts/theme-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { buildCaptureBarStyles } from "./capture-bar.styles";

export interface CaptureBarProps {
	/** Fires once the bar has taken itself out of the frame. */
	onCapture: () => void;
	onCancel: () => void;
	/** Waits for the browser to paint the hidden bar before capturing. Overridden in tests. */
	afterPaint?: ((run: () => void) => void) | undefined;
}

/**
 * The strip that replaces the report while the user goes and finds the thing
 * they want to show us — deliberately shaped like a desktop screenshot tool's
 * capture bar, because that is the interaction it is imitating.
 *
 * Enter captures and Escape cancels, so the whole flow is keyboard-only from
 * the hotkey that started it.
 */
export const CaptureBar = memo(function CaptureBar({ onCapture, onCancel, afterPaint = doubleRaf }: CaptureBarProps) {
	const { cls, tid } = useScopedStyles("capture-bar", buildCaptureBarStyles);
	const barRef = useRef<HTMLDivElement | null>(null);
	const captureRef = useRef<HTMLButtonElement | null>(null);
	const firedRef = useRef(false);

	// The bar is on top of the app it is about to photograph, so it hides itself
	// and waits for that to reach the screen — the capture reads pixels, not the
	// DOM, so an un-painted `display: none` would still show up in the image.
	const capture = useCallback(() => {
		if (firedRef.current) return;
		firedRef.current = true;
		const bar = barRef.current;
		if (bar !== null) bar.classList.add(cls("hidden"));
		afterPaint(onCapture);
	}, [afterPaint, cls, onCapture]);

	useEffect(() => {
		captureRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				event.preventDefault();
				onCancel();
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				capture();
			}
		};
		document.addEventListener("keydown", onKeyDown, true);
		return () => document.removeEventListener("keydown", onKeyDown, true);
	}, [capture, onCancel]);

	return (
		<div ref={barRef} className={cls("root")} role="dialog" aria-label="Take a screenshot" data-testid={tid("root")}>
			<span className={cls("hint")}>Go to what you want to show, then capture — Enter captures, Esc cancels.</span>
			<button ref={captureRef} type="button" className={cls("shutter")} onClick={capture} data-testid={tid("capture")}>
				<span className={cls("shutter-dot")} aria-hidden="true" />
				Capture
			</button>
			<Button onClick={onCancel} testId={tid("cancel")}>
				Cancel
			</Button>
		</div>
	);
});

/** One frame to apply the style, a second to be sure it has been presented. */
function doubleRaf(run: () => void): void {
	window.requestAnimationFrame(() => window.requestAnimationFrame(run));
}

export interface ShowCaptureBarOptions {
	cssPrefix: string;
	/** The document the bar mounts into — the Obsidian window, or a popped-out one. */
	ownerDocument?: Document | undefined;
	onCapture: () => void;
	onCancel: () => void;
}

export interface CaptureBarHandle {
	close: () => void;
}

/**
 * Mounts the capture bar outside any modal — it has to outlive the report it
 * was launched from, since the report is closed precisely so it stays out of
 * the screenshot.
 */
export function showCaptureBar({
	cssPrefix,
	ownerDocument = document,
	onCapture,
	onCancel,
}: ShowCaptureBarOptions): CaptureBarHandle {
	const host = ownerDocument.body.createDiv({ cls: `${cssPrefix}capture-bar-host` });
	const root = createRoot(host);

	let closed = false;
	const close = (): void => {
		if (closed) return;
		closed = true;
		// Unmount is deferred: React refuses to unmount a root synchronously from
		// inside the render it is committing.
		window.setTimeout(() => {
			root.unmount();
			host.remove();
		}, 0);
	};

	root.render(
		<SharedReactThemeProvider cssPrefix={cssPrefix} testIdPrefix={cssPrefix} ownerDocument={ownerDocument}>
			<CaptureBar
				onCapture={() => {
					close();
					onCapture();
				}}
				onCancel={() => {
					close();
					onCancel();
				}}
			/>
		</SharedReactThemeProvider>
	);

	return { close };
}
