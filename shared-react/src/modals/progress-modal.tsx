import type { App } from "obsidian";
import type { RefObject } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactModal } from "../show-react-modal";
import { cx } from "../utils/cx";
import { buildProgressStyles } from "./progress-modal.styles";

const DEFAULT_TITLE = "Processing...";
const DEFAULT_STATUS_TEMPLATE = "Processing {current} of {total}...";
const DEFAULT_INITIAL_DETAILS = "Starting...";
const DEFAULT_SUCCESS_CLOSE_DELAY = 2000;
const DEFAULT_ERROR_CLOSE_DELAY = 3000;

interface ProgressState {
	current: number;
	detail: string;
	status: "progress" | "complete" | "error";
	statusText: string;
}

interface ProgressContentProps {
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
	title,
	total,
	statusTemplate,
	initialDetails,
	stateRef,
	close,
	successCloseDelay,
	errorCloseDelay,
}: ProgressContentProps) {
	const { cls, tid, cssPrefix } = useScoped("progress");
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
	const barClass = cx(
		cls("bar"),
		state.status === "complete" && cls("complete"),
		state.status === "error" && cls("error")
	);

	return (
		<div className={cls("modal")} data-testid={tid("modal")}>
			<h2>{title}</h2>
			<div className={cls("status")} data-testid={tid("status")}>
				{state.statusText}
			</div>
			<div className={cls("container")}>
				<div className={barClass} style={{ width: `${percentage}%` }} data-testid={tid("bar")} />
			</div>
			<div className={cls("details")} data-testid={tid("details")}>
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
		cssPrefix,
		testIdPrefix: cssPrefix,
		render: (close) => {
			closeModal = close;
			return (
				<ProgressContent
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
