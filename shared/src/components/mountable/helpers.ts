import { injectStyleSheet } from "../../utils/styles/inject";

function buildLoadingStyles(prefix: string): string {
	const p = prefix ? `${prefix}-mountable` : "mountable";
	return `
@keyframes ${p}-spin {
	0% { transform: rotate(0); }
	100% { transform: rotate(360deg); }
}
.${p}-loading-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 2rem;
	min-height: 100px;
}
.${p}-loading-spinner {
	width: 20px;
	height: 20px;
	border: 2px solid var(--background-modifier-border);
	border-top: 2px solid var(--interactive-accent);
	border-radius: 50%;
	animation: ${p}-spin 1s linear infinite;
	margin: 0 auto 8px;
}
.${p}-loading-text {
	text-align: center;
	color: var(--text-muted);
	font-size: 0.9em;
}
`;
}

/**
 * Encapsulates shared state and helpers for mountable views and components.
 * Both MountableView and MountableComponent delegate to an instance of this class.
 */
export class MountableHelpers {
	private loadingEl: HTMLElement | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
	private readonly classPrefix: string;
	private readonly prefix: string;

	constructor(
		prefix: string | undefined,
		private registerCleanup?: (cb: () => void) => void
	) {
		this.prefix = prefix ?? "";
		this.classPrefix = prefix ? `${prefix}-mountable` : "mountable";
	}

	showLoading(
		container: HTMLElement,
		text = "Loading…",
		classes?: { container?: string; spinner?: string; text?: string }
	): void {
		injectStyleSheet(`${this.classPrefix}-loading-styles`, buildLoadingStyles(this.prefix));
		this.hideLoading();

		const containerClass = classes?.container ?? `${this.classPrefix}-loading-container`;
		const spinnerClass = classes?.spinner ?? `${this.classPrefix}-loading-spinner`;
		const textClass = classes?.text ?? `${this.classPrefix}-loading-text`;

		this.loadingEl = container.createDiv(containerClass);
		this.loadingEl.createDiv(spinnerClass);
		const t = this.loadingEl.createDiv(textClass);
		t.textContent = text;
	}

	hideLoading(): void {
		this.loadingEl?.remove();
		this.loadingEl = null;
	}

	observeResize(el: HTMLElement, cb: () => void, delay = 100): void {
		if (!("ResizeObserver" in window)) return;
		this.resizeObserver = new ResizeObserver(() => {
			if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
			this.resizeTimeout = setTimeout(cb, delay);
		});
		this.resizeObserver.observe(el);
		this.registerCleanup?.(() => this.destroyResize());
	}

	waitForLayout(el: HTMLElement, fallbackMs = 500): Promise<void> {
		return new Promise<void>((resolve) => {
			const check = () => {
				const r = el.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) {
					resolve();
				} else {
					requestAnimationFrame(check);
				}
			};
			check();
			setTimeout(resolve, fallbackMs);
		});
	}

	cleanup(): void {
		this.destroyResize();
		this.hideLoading();
	}

	private destroyResize(): void {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
			this.resizeTimeout = null;
		}
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}
}
