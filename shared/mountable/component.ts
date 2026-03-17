import type { Component } from "obsidian";

import { MountableHelpers } from "./helpers";

type AbstractCtor<T = Record<string, never>> = abstract new (...args: any[]) => T;

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
		#helpers: MountableHelpers;

		constructor(..._args: any[]) {
			super(..._args);
			this.#helpers = new MountableHelpers(prefix, (cb) => this.register(cb));
		}

		abstract mount(): Promise<void>;
		abstract unmount(): Promise<void>;

		showLoading(
			container: HTMLElement,
			text = "Loading…",
			classes?: { container?: string; spinner?: string; text?: string }
		): void {
			this.#helpers.showLoading(container, text, classes);
		}

		hideLoading(): void {
			this.#helpers.hideLoading();
		}

		observeResize(el: HTMLElement, cb: () => void, delay = 100): void {
			this.#helpers.observeResize(el, cb, delay);
		}

		waitForLayout(el: HTMLElement, fallbackMs = 500): Promise<void> {
			return this.#helpers.waitForLayout(el, fallbackMs);
		}

		onload(): void {
			void this.mount();
		}

		onunload(): void {
			void this.unmount().finally(() => {
				this.#helpers.cleanup();
			});
		}
	}

	return Mountable;
}
