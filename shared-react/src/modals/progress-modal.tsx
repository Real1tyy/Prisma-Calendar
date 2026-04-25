import type { App } from "obsidian";
import type { RefObject } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactModal } from "../show-react-modal";

const DEFAULT_TITLE = "Processing...";
const DEFAULT_STATUS_TEMPLATE = "Processing {current} of {total}...";
const DEFAULT_INITIAL_DETAILS = "Starting...";
const DEFAULT_SUCCESS_CLOSE_DELAY = 2000;
const DEFAULT_ERROR_CLOSE_DELAY = 3000;

function buildProgressStyles(p: string): string {
	return `
.${p}progress-modal { padding: 2rem; min-width: 400px; }
.${p}progress-modal h2 { margin: 0 0 2.5rem 0; font-size: 1.8rem; font-weight: 600; text-align: center; color: var(--text-normal); }
.${p}progress-status { font-size: 1.3rem; font-weight: 600; color: var(--text-normal); margin-bottom: 1.5rem; text-align: center; letter-spacing: 0.3px; }
.${p}progress-container { width: 100%; height: 40px; background: var(--background-secondary); border-radius: 20px; overflow: hidden; margin-bottom: 2rem; border: 2px solid var(--background-modifier-border); box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1); }
.${p}progress-bar { height: 100%; background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover)); transition: width 0.3s ease; border-radius: 20px; box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3); }
.${p}progress-complete { --${p}success-rgb: 76, 175, 80; background: linear-gradient(90deg, rgb(var(--${p}success-rgb)), rgb(102, 187, 106)); box-shadow: 0 2px 8px rgba(var(--${p}success-rgb), 0.3); }
.${p}progress-error { --${p}error-rgb: 244, 67, 54; background: linear-gradient(90deg, rgb(var(--${p}error-rgb)), rgb(239, 83, 80)); box-shadow: 0 2px 8px rgba(var(--${p}error-rgb), 0.3); }
.${p}progress-details { font-size: 1.1rem; color: var(--text-muted); text-align: center; min-height: 2rem; word-break: break-word; line-height: 1.5; }
`;
}

interface ProgressState {
	current: number;
	detail: string;
	status: "progress" | "complete" | "error";
	statusText: string;
}

interface ProgressContentProps {
	cssPrefix: string;
	title: string;
	total: number;
	statusTemplate: string;
	initialDetails: string;
	stateRef: RefObject<{
		update: (current: number, detail?: string) => void;
		complete: (summaryLines: string[]) => void;
		error: (message: string) => void;
	} | null>;
	close: () => void;
	successCloseDelay: number;
	errorCloseDelay: number;
}

export const ProgressContent = memo(function ProgressContent({
	cssPrefix,
	title,
	total,
	statusTemplate,
	initialDetails,
	stateRef,
	close,
	successCloseDelay,
	errorCloseDelay,
}: ProgressContentProps) {
	useInjectedStyles(`${cssPrefix}progress-modal-styles`, buildProgressStyles(cssPrefix));

	const safeTotal = Math.max(total, 1);
	const baseTitle = title.replace(/\.{3}$/, "");

	const formatStatus = useCallback(
		(current: number) => statusTemplate.replace("{current}", String(current)).replace("{total}", String(safeTotal)),
		[statusTemplate, safeTotal]
	);

	const [state, setState] = useState<ProgressState>({
		current: 0,
		detail: initialDetails,
		status: "progress",
		statusText: formatStatus(0),
	});

	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	useEffect(() => {
		stateRef.current = {
			update: (current: number, detail?: string) => {
				const clamped = Math.max(0, Math.min(current, safeTotal));
				setState((prev) =>
					prev.status !== "progress"
						? prev
						: {
								current: clamped,
								detail: detail ?? prev.detail,
								status: "progress",
								statusText: formatStatus(clamped),
							}
				);
			},
			complete: (summaryLines: string[]) => {
				setState((prev) =>
					prev.status !== "progress"
						? prev
						: {
								current: safeTotal,
								detail: summaryLines.join("  •  "),
								status: "complete",
								statusText: baseTitle + " complete",
							}
				);
				timerRef.current = setTimeout(close, successCloseDelay);
			},
			error: (message: string) => {
				setState((prev) =>
					prev.status !== "progress"
						? prev
						: {
								...prev,
								detail: message,
								status: "error",
								statusText: baseTitle + " failed",
							}
				);
				timerRef.current = setTimeout(close, errorCloseDelay);
			},
		};
	}, [stateRef, safeTotal, formatStatus, baseTitle, close, successCloseDelay, errorCloseDelay]);

	const percentage = Math.round((state.current / safeTotal) * 100);
	const barClass = [
		`${cssPrefix}progress-bar`,
		state.status === "complete" ? `${cssPrefix}progress-complete` : "",
		state.status === "error" ? `${cssPrefix}progress-error` : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={`${cssPrefix}progress-modal`} data-testid={`${cssPrefix}progress-modal`}>
			<h2>{title}</h2>
			<div className={`${cssPrefix}progress-status`} data-testid={`${cssPrefix}progress-status`}>
				{state.statusText}
			</div>
			<div className={`${cssPrefix}progress-container`}>
				<div className={barClass} style={{ width: `${percentage}%` }} data-testid={`${cssPrefix}progress-bar`} />
			</div>
			<div className={`${cssPrefix}progress-details`} data-testid={`${cssPrefix}progress-details`}>
				{state.detail}
			</div>
		</div>
	);
});

export interface ProgressModalConfig {
	app: App;
	cssPrefix: string;
	total: number;
	title?: string;
	statusTemplate?: string;
	initialDetails?: string;
	successCloseDelay?: number;
	errorCloseDelay?: number;
}

export interface ProgressModalHandle {
	updateProgress: (current: number, detail?: string) => void;
	showComplete: (summaryLines: string[]) => void;
	showError: (message: string) => void;
	close: () => void;
}

export function openProgressModal(app: App, config: ProgressModalConfig): ProgressModalHandle {
	const {
		cssPrefix,
		total,
		title = DEFAULT_TITLE,
		statusTemplate = DEFAULT_STATUS_TEMPLATE,
		initialDetails = DEFAULT_INITIAL_DETAILS,
		successCloseDelay = DEFAULT_SUCCESS_CLOSE_DELAY,
		errorCloseDelay = DEFAULT_ERROR_CLOSE_DELAY,
	} = config;

	const stateRef: RefObject<{
		update: (current: number, detail?: string) => void;
		complete: (summaryLines: string[]) => void;
		error: (message: string) => void;
	} | null> = { current: null };

	let closeModal: (() => void) | null = null;

	showReactModal({
		app,
		cls: `${cssPrefix}progress-modal-wrapper`,
		render: (close) => {
			closeModal = close;
			return (
				<ProgressContent
					cssPrefix={cssPrefix}
					title={title}
					total={total}
					statusTemplate={statusTemplate}
					initialDetails={initialDetails}
					stateRef={stateRef}
					close={close}
					successCloseDelay={successCloseDelay}
					errorCloseDelay={errorCloseDelay}
				/>
			);
		},
	});

	return {
		updateProgress: (current, detail) => stateRef.current?.update(current, detail),
		showComplete: (summaryLines) => stateRef.current?.complete(summaryLines),
		showError: (message) => stateRef.current?.error(message),
		close: () => closeModal?.(),
	};
}
