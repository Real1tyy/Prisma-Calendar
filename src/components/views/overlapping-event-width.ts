import { toggleCls } from "../../constants";
import { DEFAULT_OVERLAPPING_EVENT_WIDTH, type EventOverlapWidth } from "../../types/view";

const forwardHarnessObservers = new WeakMap<HTMLElement, MutationObserver>();

// The default leaves FullCalendar's own geometry untouched, so three-way overlaps keep their thirds.
// A custom width re-marks the forward events whenever FullCalendar rewrites its inline layout.
export function applyOverlappingEventWidth(container: HTMLElement, width: EventOverlapWidth): void {
	const custom = width !== DEFAULT_OVERLAPPING_EVENT_WIDTH;
	toggleCls(container, "custom-overlapping-event-width", custom);
	container.style.setProperty("--overlapping-event-width", width);

	const observer = forwardHarnessObservers.get(container);
	if (!custom) {
		observer?.disconnect();
		forwardHarnessObservers.delete(container);
		return;
	}
	if (observer) return;

	const next = new MutationObserver(() => markForwardHarnesses(container));
	next.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
	forwardHarnessObservers.set(container, next);
	markForwardHarnesses(container);
}

// FullCalendar puts `-inset` on every placed harness, so its inline percentages are the only
// signal: the forward event reaches the far edge from a non-zero near edge. Drag mirrors are
// positioned in px, so they never qualify.
export function markForwardHarnesses(container: HTMLElement): void {
	for (const harness of Array.from(container.querySelectorAll<HTMLElement>(".fc-timegrid-event-harness"))) {
		const rtl = harness.closest(".fc-direction-rtl") !== null;
		const near = rtl ? harness.style.right : harness.style.left;
		const far = rtl ? harness.style.left : harness.style.right;
		const isForward = near.endsWith("%") && Number.parseFloat(near) > 0 && Number.parseFloat(far) === 0;
		toggleCls(harness, "overlap-forward", isForward);
	}
}
