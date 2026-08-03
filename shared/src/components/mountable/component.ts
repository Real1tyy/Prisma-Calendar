import type { Component } from "obsidian";

import { MountableHelpers } from "./helpers";

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
// Deliberately NOT generic over the base class. A mixin whose base is a type
// parameter forces `constructor(...args: any[])` (TS2545), and `any` cannot be
// suppressed in code Obsidian reviews. Both mixins are only ever applied to the
// one concrete Obsidian base named here, so the generic bought nothing.
export function MountableComponent(Base: typeof Component, prefix?: string) {
	abstract class Mountable extends Base {
		#helpers: MountableHelpers;

		constructor() {
			super();
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

		override onload(): void {
			void this.mount();
		}

		override onunload(): void {
			void this.unmount().finally(() => {
				this.#helpers.cleanup();
			});
		}
	}

	return Mountable;
}
