import type { App } from "obsidian";

import { createCssUtils } from "../../utils/css-utils";
import { injectStyleSheet } from "../../utils/styles/inject";
import { showModal } from "../component-renderer/modal";

// ─── Types ───

export interface ProgressModalConfig {
	app: App;
	/** CSS prefix for all class names (e.g. "prisma-") */
	cssPrefix: string;
	/** Total number of items to process */
	total: number;
	/** Modal heading (default: "Processing...") */
	title?: string;
	/** Template for status text. Use `{current}` and `{total}` placeholders (default: "Processing {current} of {total}...") */
	statusTemplate?: string;
	/** Initial details text shown before first update (default: "Starting...") */
	initialDetails?: string;
	/** Auto-close delay in ms after success (default: 2000) */
	successCloseDelay?: number;
	/** Auto-close delay in ms after error (default: 3000) */
	errorCloseDelay?: number;
	/** Whether clicking the backdrop dismisses the modal during progress (default: false) */
	dismissibleDuringProgress?: boolean;
}

export interface ProgressModalHandle {
	/** Update progress bar and status text */
	updateProgress: (current: number, detail?: string) => void;
	/** Show success state with summary lines */
	showComplete: (summaryLines: string[]) => void;
	/** Show error state with message */
	showError: (message: string) => void;
	/** Programmatically close the modal */
	close: () => void;
}

// ─── Defaults ───

const DEFAULT_TITLE = "Processing...";
const DEFAULT_STATUS_TEMPLATE = "Processing {current} of {total}...";
const DEFAULT_INITIAL_DETAILS = "Starting...";
const DEFAULT_SUCCESS_CLOSE_DELAY = 2000;
const DEFAULT_ERROR_CLOSE_DELAY = 3000;

// ─── CSS Class Suffixes ───

const MODAL_SUFFIX = "progress-modal";
const STATUS_SUFFIX = "progress-status";
const CONTAINER_SUFFIX = "progress-container";
const BAR_SUFFIX = "progress-bar";
const DETAILS_SUFFIX = "progress-details";

// ─── Styles ───

function buildProgressStyles(p: string): string {
	return `
.${p}${MODAL_SUFFIX} {
	padding: 2rem;
	min-width: 400px;
}

.${p}${MODAL_SUFFIX} h2 {
	margin: 0 0 2.5rem 0;
	font-size: 1.8rem;
	font-weight: 600;
	text-align: center;
	color: var(--text-normal);
}

.${p}${STATUS_SUFFIX} {
	font-size: 1.3rem;
	font-weight: 600;
	color: var(--text-normal);
	margin-bottom: 1.5rem;
	text-align: center;
	letter-spacing: 0.3px;
}

.${p}${CONTAINER_SUFFIX} {
	width: 100%;
	height: 40px;
	background: var(--background-secondary);
	border-radius: 20px;
	overflow: hidden;
	margin-bottom: 2rem;
	border: 2px solid var(--background-modifier-border);
	box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.${p}${BAR_SUFFIX} {
	height: 100%;
	background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
	transition: width 0.3s ease;
	border-radius: 20px;
	box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
	width: 0%;
}

.${p}${BAR_SUFFIX}.${p}progress-complete {
	--${p}success-rgb: 76, 175, 80;
	background: linear-gradient(90deg, rgb(var(--${p}success-rgb)), rgb(102, 187, 106));
	box-shadow: 0 2px 8px rgba(var(--${p}success-rgb), 0.3);
}

.${p}${BAR_SUFFIX}.${p}progress-error {
	--${p}error-rgb: 244, 67, 54;
	background: linear-gradient(90deg, rgb(var(--${p}error-rgb)), rgb(239, 83, 80));
	box-shadow: 0 2px 8px rgba(var(--${p}error-rgb), 0.3);
}

.${p}${DETAILS_SUFFIX} {
	font-size: 1.1rem;
	color: var(--text-muted);
	text-align: center;
	min-height: 2rem;
	word-break: break-word;
	line-height: 1.5;
}
`;
}

// ─── Component ───

export function showProgressModal(config: ProgressModalConfig): ProgressModalHandle {
	const {
		app,
		cssPrefix,
		total,
		title = DEFAULT_TITLE,
		statusTemplate = DEFAULT_STATUS_TEMPLATE,
		initialDetails = DEFAULT_INITIAL_DETAILS,
		successCloseDelay = DEFAULT_SUCCESS_CLOSE_DELAY,
		errorCloseDelay = DEFAULT_ERROR_CLOSE_DELAY,
		dismissibleDuringProgress = false,
	} = config;

	const css = createCssUtils(cssPrefix);
	const safeTotal = Math.max(total, 1);
	const baseTitle = title.replace(/\.{3}$/, "");

	injectStyleSheet(`${cssPrefix}progress-modal-styles`, buildProgressStyles(cssPrefix));

	let progressBar: HTMLElement;
	let statusText: HTMLElement;
	let detailsText: HTMLElement;
	let isComplete = false;
	let closeModal: (() => void) | null = null;
	let pendingTimer: ReturnType<typeof setTimeout> | null = null;

	const formatStatus = (current: number): string =>
		statusTemplate.replace("{current}", String(current)).replace("{total}", String(safeTotal));

	showModal({
		app,
		cls: css.cls(MODAL_SUFFIX),
		render: (el, ctx) => {
			closeModal = ctx.close;

			el.setAttribute("data-testid", `${cssPrefix}progress-modal`);

			el.createEl("h2", { text: title });

			statusText = el.createDiv(css.cls(STATUS_SUFFIX));
			statusText.setAttribute("data-testid", `${cssPrefix}progress-status`);
			statusText.setText(formatStatus(0));

			const progressContainer = el.createDiv(css.cls(CONTAINER_SUFFIX));
			progressBar = progressContainer.createDiv(css.cls(BAR_SUFFIX));
			progressBar.setAttribute("data-testid", `${cssPrefix}progress-bar`);

			detailsText = el.createDiv(css.cls(DETAILS_SUFFIX));
			detailsText.setAttribute("data-testid", `${cssPrefix}progress-details`);
			detailsText.setText(initialDetails);

			if (!dismissibleDuringProgress && ctx.type === "modal") {
				ctx.modalEl.addEventListener("click", (e) => {
					if (!isComplete && e.target === ctx.modalEl) {
						e.stopPropagation();
					}
				});
			}
		},
	});

	const scheduleClose = (delay: number): void => {
		pendingTimer = setTimeout(() => {
			pendingTimer = null;
			closeModal?.();
		}, delay);
	};

	return {
		updateProgress(current: number, detail?: string): void {
			if (isComplete) return;
			const clamped = Math.max(0, Math.min(current, safeTotal));
			const percentage = Math.round((clamped / safeTotal) * 100);
			progressBar?.setCssProps({ width: `${percentage}%` });
			statusText?.setText(formatStatus(clamped));
			if (detail) {
				detailsText?.setText(detail);
			}
		},

		showComplete(summaryLines: string[]): void {
			if (isComplete) return;
			isComplete = true;
			progressBar?.setCssProps({ width: "100%" });
			if (progressBar) css.addCls(progressBar, "progress-complete");
			statusText?.setText(baseTitle + " complete");
			detailsText?.setText(summaryLines.join("  •  "));
			scheduleClose(successCloseDelay);
		},

		showError(message: string): void {
			if (isComplete) return;
			isComplete = true;
			if (progressBar) css.addCls(progressBar, "progress-error");
			statusText?.setText(baseTitle + " failed");
			detailsText?.setText(message);
			scheduleClose(errorCloseDelay);
		},

		close(): void {
			if (pendingTimer) clearTimeout(pendingTimer);
			pendingTimer = null;
			closeModal?.();
		},
	};
}
