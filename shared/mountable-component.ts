import type { Component } from "obsidian";

import { injectStyleSheet } from "./styles/inject";

type AbstractCtor<T = Record<string, never>> = abstract new (...args: any[]) => T;

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
 * Mixin that adds lifecycle helpers to any Component subclass.
 * Mirrors MountableView but works with Component instead of ItemView.
 *
 * Usage:
 * ```ts
 * class MyComponent extends MountableComponent(Component, "prisma") {
 *   async mount(): Promise<void> { ... }
 *   async unmount(): Promise<void> { ... }
 * }
 * ```
 */
export function MountableComponent<TBase extends AbstractCtor<Component>>(Base: TBase, prefix?: string) {
	abstract class Mountable extends Base {
		constructor(..._args: any[]) {
			super(..._args);
			this.#classPrefix = prefix ? `${prefix}-mountable` : "mountable";
		}

		#resizeObserver: ResizeObserver | null = null;
		#resizeTimeout: ReturnType<typeof setTimeout> | null = null;
		#loadingEl: HTMLElement | null = null;
		#classPrefix: string;

		abstract mount(): Promise<void>;
		abstract unmount(): Promise<void>;

		showLoading(
			container: HTMLElement,
			text = "Loading…",
			classes?: {
				container?: string;
				spinner?: string;
				text?: string;
			}
		): void {
			injectStyleSheet(`${this.#classPrefix}-loading-styles`, buildLoadingStyles(prefix ?? ""));
			this.hideLoading();
			const containerClass = classes?.container ?? `${this.#classPrefix}-loading-container`;
			const spinnerClass = classes?.spinner ?? `${this.#classPrefix}-loading-spinner`;
			const textClass = classes?.text ?? `${this.#classPrefix}-loading-text`;

			this.#loadingEl = container.createDiv(containerClass);
			this.#loadingEl.createDiv(spinnerClass);
			const t = this.#loadingEl.createDiv(textClass);
			t.textContent = text;
		}

		hideLoading(): void {
			this.#loadingEl?.remove();
			this.#loadingEl = null;
		}

		observeResize(el: HTMLElement, cb: () => void, delay = 100): void {
			if (!("ResizeObserver" in window)) return;
			this.#resizeObserver = new ResizeObserver(() => {
				if (this.#resizeTimeout) clearTimeout(this.#resizeTimeout);
				this.#resizeTimeout = setTimeout(cb, delay);
			});
			this.#resizeObserver.observe(el);
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

		onload(): void {
			void this.mount();
		}

		onunload(): void {
			void this.unmount().finally(() => {
				if (this.#resizeTimeout) {
					clearTimeout(this.#resizeTimeout);
					this.#resizeTimeout = null;
				}
				this.#resizeObserver?.disconnect();
				this.#resizeObserver = null;
				this.hideLoading();
			});
		}
	}

	return Mountable;
}
