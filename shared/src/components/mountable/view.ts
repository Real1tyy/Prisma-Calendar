import type { ItemView } from "obsidian";

import { MountableHelpers } from "./helpers";

type AbstractCtor<T = Record<string, never>> = abstract new (...args: any[]) => T;

export function MountableView<TBase extends AbstractCtor<ItemView>>(Base: TBase, prefix?: string) {
	abstract class Mountable extends Base {
		#helpers: MountableHelpers;
		#mounted = false;

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

		addEventListenerSub<K extends keyof HTMLElementEventMap>(
			el: HTMLElement,
			type: K,
			listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
			options?: boolean | AddEventListenerOptions
		): void {
			this.registerDomEvent(el, type, listener, options);
		}

		addWorkspaceEventSub(eventName: string, callback: (...args: unknown[]) => void): void {
			// @ts-expect-error - Support custom event names not in type definition
			const ref = this.app.workspace.on(eventName, callback);
			this.registerEvent(ref);
		}

		override async onOpen(): Promise<void> {
			if (this.#mounted) return;
			this.#mounted = true;
			try {
				await this.mount();
			} catch (e) {
				this.#mounted = false;
				throw e;
			}
		}

		override async onClose(): Promise<void> {
			try {
				await this.unmount();
			} finally {
				this.#helpers.cleanup();
				this.#mounted = false;
			}
		}
	}

	return Mountable;
}
