import type { Calendar } from "@fullcalendar/core";
import { renderReactInline } from "@real1ty/obsidian-plugins-react";
import type { App } from "obsidian";
import { createElement, createRef } from "react";

import type { CalendarBundle } from "../core/calendar-bundle";
import {
	UntrackedEventsDropdown as UntrackedEventsDropdownReact,
	type UntrackedEventsDropdownHandle,
} from "../react/views/untracked-events-dropdown";

const BUTTON_INJECT_DELAY_MS = 100;

// FullCalendar always emits three chunks in DOM order, so nth-child is the only
// handle on the middle one — it carries no distinguishing class.
const TOOLBAR_CHUNK_SELECTORS = {
	left: ".fc-toolbar-chunk:first-child",
	center: ".fc-toolbar-chunk:nth-child(2)",
	right: ".fc-toolbar-chunk:last-child",
} as const;

export class UntrackedEventsDropdown {
	private wrapperEl: HTMLDivElement | null = null;
	private unmount: (() => void) | null = null;
	private readonly handleRef = createRef<UntrackedEventsDropdownHandle>();
	private injectTimeout: number | null = null;

	constructor(
		private readonly app: App,
		private readonly bundle: CalendarBundle
	) {}

	initialize(
		_calendar: Calendar | null,
		container: HTMLElement,
		placement: "left" | "center" | "right" = "right"
	): void {
		this.injectTimeout = window.setTimeout(() => {
			this.injectTimeout = null;
			const slot = container.querySelector(TOOLBAR_CHUNK_SELECTORS[placement]);
			if (!slot) return;

			this.wrapperEl = createDiv({ cls: "prisma-untracked-dropdown-wrapper" });

			// Leading edge everywhere except the left chunk, whose leading edge is
			// already the nav buttons — there the dropdown belongs at the end.
			if (placement === "left") {
				slot.appendChild(this.wrapperEl);
			} else {
				slot.prepend(this.wrapperEl);
			}

			this.unmount = renderReactInline(
				this.wrapperEl,
				createElement(UntrackedEventsDropdownReact, { bundle: this.bundle, ref: this.handleRef }),
				this.app
			);
		}, BUTTON_INJECT_DELAY_MS);
	}

	destroy(): void {
		if (this.injectTimeout !== null) {
			window.clearTimeout(this.injectTimeout);
			this.injectTimeout = null;
		}
		this.unmount?.();
		this.unmount = null;
		this.wrapperEl?.remove();
		this.wrapperEl = null;
	}

	toggle(): void {
		this.handleRef.current?.toggle();
	}

	restoreIfTemporarilyHidden(): void {
		this.handleRef.current?.restoreIfTemporarilyHidden();
	}

	ignoreOutsideClicksFor(ms: number): void {
		this.handleRef.current?.ignoreOutsideClicksFor(ms);
	}
}
