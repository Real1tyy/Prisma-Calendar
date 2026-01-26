import type { ItemView } from "obsidian";

type AbstractCtor<T = Record<string, never>> = abstract new (...args: any[]) => T;

export function MountableView<TBase extends AbstractCtor<ItemView>>(Base: TBase, prefix?: string) {
	abstract class Mountable extends Base {
		constructor(..._args: any[]) {
			super(..._args);
			this.#classPrefix = prefix ? `${prefix}-mountable` : "mountable";
		}
		// use ECMAScript private fields to avoid TS4094
		#mounted = false;
		#resizeObserver: ResizeObserver | null = null;
		#resizeTimeout: ReturnType<typeof setTimeout> | null = null;
		#loadingEl: HTMLElement | null = null;
		#classPrefix: string;

		abstract mount(): Promise<void>;
		abstract unmount(): Promise<void>;

		/**
		 * Shows a loading indicator in the specified container.
		 *
		 * **Styling Requirements:**
		 * Inheritors must provide CSS styles in their plugin's `styles.css` file for the following classes.
		 * The class names are prefixed based on the prefix passed to `MountableView()`.
		 *
		 * Default classes (when no prefix is provided):
		 * - `.mountable-loading-container` - Container element (flex layout recommended)
		 * - `.mountable-loading-spinner` - Spinner element (animation recommended)
		 * - `.mountable-loading-text` - Text element
		 *
		 * With prefix (e.g., `MountableView(Base, "prisma")`):
		 * - `.prisma-mountable-loading-container`
		 * - `.prisma-mountable-loading-spinner`
		 * - `.prisma-mountable-loading-text`
		 *
		 * **Example CSS (with "prisma" prefix):**
		 * ```css
		 * @keyframes prisma-mountable-spin {
		 *   0% { transform: rotate(0); }
		 *   100% { transform: rotate(360deg); }
		 * }
		 *
		 * .prisma-mountable-loading-container {
		 *   display: flex;
		 *   flex-direction: column;
		 *   align-items: center;
		 *   justify-content: center;
		 *   padding: 2rem;
		 *   min-height: 100px;
		 * }
		 *
		 * .prisma-mountable-loading-spinner {
		 *   width: 20px;
		 *   height: 20px;
		 *   border: 2px solid var(--background-modifier-border);
		 *   border-top: 2px solid var(--interactive-accent);
		 *   border-radius: 50%;
		 *   animation: prisma-mountable-spin 1s linear infinite;
		 *   margin: 0 auto 8px;
		 * }
		 *
		 * .prisma-mountable-loading-text {
		 *   text-align: center;
		 *   color: var(--text-muted);
		 *   font-size: 0.9em;
		 * }
		 * ```
		 *
		 * **Custom Class Names:**
		 * You can override the default class names by passing custom classes:
		 * ```typescript
		 * this.showLoading(container, "Loading…", {
		 *   container: "my-custom-loading",
		 *   spinner: "my-custom-spinner",
		 *   text: "my-custom-text"
		 * });
		 * ```
		 *
		 * @param container - The container element where the loading indicator will be displayed
		 * @param text - The loading text to display (default: "Loading…")
		 * @param classes - Optional custom CSS class names to use instead of defaults
		 */
		showLoading(
			container: HTMLElement,
			text = "Loading…",
			classes?: {
				container?: string;
				spinner?: string;
				text?: string;
			}
		): void {
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

		addEventListenerSub<K extends keyof HTMLElementEventMap>(
			el: HTMLElement,
			type: K,
			listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
			options?: boolean | AddEventListenerOptions
		): void {
			this.registerDomEvent(el, type, listener, options);
		}

		addWorkspaceEventSub(eventName: string, callback: (...args: unknown[]) => void): void {
			// Type assertion needed because workspace.on() has specific event name overloads
			// but we need to support custom event names from plugins
			// @ts-expect-error - We need to support custom event names that aren't in the type definition
			const ref = this.app.workspace.on(eventName, callback);
			this.registerEvent(ref);
		}

		async onOpen(): Promise<void> {
			if (this.#mounted) return;
			this.#mounted = true;
			try {
				await this.mount();
			} catch (e) {
				this.#mounted = false;
				throw e;
			}
		}

		async onClose(): Promise<void> {
			try {
				await this.unmount();
			} finally {
				if (this.#resizeTimeout) {
					clearTimeout(this.#resizeTimeout);
					this.#resizeTimeout = null;
				}
				this.#resizeObserver?.disconnect();
				this.#resizeObserver = null;
				this.hideLoading();
				this.#mounted = false;
			}
		}
	}

	return Mountable;
}
