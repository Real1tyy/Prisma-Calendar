import { applyClsTokens } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import { useEffect, useState } from "react";

export interface UseModalPortalOptions {
	app: App;
	open: boolean;
	title?: string;
	cls?: string;
	testId?: string;
	onClose: () => void;
}

export interface ModalPortalHandle {
	contentEl: HTMLElement | null;
}

/**
 * React-friendly bridge to an Obsidian `Modal`. Lets a component render its
 * modal body inline (via `createPortal(node, contentEl)`) while still using the
 * native modal chrome, focus trap, and dismiss handling.
 *
 * The teardown sequence is critical: React must unmount the portal contents
 * *before* Obsidian detaches the modal DOM. If we let Obsidian close first
 * (via Esc, the X button, or our cleanup calling `modal.close()`), Obsidian's
 * `contentEl.empty()` strips the portal's children outside of React's view
 * and the next reconciliation crashes with `removeChild: not a child of this
 * node`. We:
 *
 * 1. Override `close()` so every entry point (Esc, X button, our cleanup)
 *    runs through the same teardown.
 * 2. Set `contentEl` to `null` so React stops rendering into the modal body
 *    on its next commit.
 * 3. Defer `super.close()` (which runs Obsidian's DOM teardown) to a
 *    `queueMicrotask`, giving React room to flush the portal unmount before
 *    Obsidian destroys the host.
 * 4. Use a `closed` latch so re-entry from any direction is a no-op.
 *
 * `flushSync` would be the obvious tool but it's banned inside React's commit
 * phase (effect cleanups), which is exactly where the consumer-triggered close
 * runs. The microtask handoff sidesteps that without changing the public API.
 */
export function useModalPortal({ app, open, title, cls, testId, onClose }: UseModalPortalOptions): ModalPortalHandle {
	const [contentEl, setContentEl] = useState<HTMLElement | null>(null);

	useEffect(() => {
		if (!open) return;
		let closed = false;

		class PortalModal extends Modal {
			override onOpen(): void {
				const { modalEl, contentEl: el } = this;
				el.empty();
				applyClsTokens(modalEl, cls);
				if (title) this.setTitle(title);
				if (testId) modalEl.setAttribute("data-testid", testId);
				setContentEl(el);
			}

			override close(): void {
				if (closed) return;
				closed = true;
				// Disarm contentEl.empty() before super.close() runs so Obsidian
				// can't strip React's portal children. React will remove them on
				// the next render via setContentEl(null) below.
				const el = this.contentEl as HTMLElement & { empty?: () => void };
				if (typeof el.empty === "function") el.empty = () => {};
				setContentEl(null);
				onClose();
				super.close();
			}
		}

		const modal = new PortalModal(app);
		modal.open();

		return () => {
			modal.close();
		};
	}, [app, open, title, cls, testId, onClose]);

	return { contentEl };
}
