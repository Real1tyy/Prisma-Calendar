import { cls, toggleCls } from "../../constants";
import { DEFAULT_OVERLAPPING_EVENT_WIDTH, type EventOverlapWidth } from "../../types/view";

const HARNESS = "fc-timegrid-event-harness";
const FORWARD = cls("overlap-forward");
const COVERED = cls("overlap-covered");
const CONTENT = cls("fc-event-content-wrapper");
const VISIBLE_WIDTH_VAR = "--prisma-overlap-visible-width";
// Sub-pixel rounding between neighbouring harnesses must not read as an overlap.
const EDGE_EPSILON_PX = 1;

const layoutObservers = new WeakMap<HTMLElement, MutationObserver>();

export interface OverlapLayoutOptions {
	slotEventOverlap: boolean;
	width: EventOverlapWidth;
}

// Stacked layout only: FullCalendar's side-by-side columns never cover one another. The layout is
// re-applied whenever FullCalendar rewrites a harness's inline geometry or re-renders a column.
export function applyOverlapLayout(container: HTMLElement, { slotEventOverlap, width }: OverlapLayoutOptions): void {
	toggleCls(container, "custom-overlapping-event-width", slotEventOverlap && width !== DEFAULT_OVERLAPPING_EVENT_WIDTH);
	container.style.setProperty("--overlapping-event-width", width);

	const observer = layoutObservers.get(container);
	if (!slotEventOverlap) {
		observer?.disconnect();
		layoutObservers.delete(container);
		clearOverlapMarks(container);
		return;
	}
	if (!observer) {
		const next = new MutationObserver((records) => {
			if (records.some(isLayoutMutation)) relayoutOverlaps(container);
		});
		next.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
		layoutObservers.set(container, next);
	}
	relayoutOverlaps(container);
}

// Our own writes land on the content wrapper; only FullCalendar's harness geometry and
// re-renders change the layout.
function isLayoutMutation(record: MutationRecord): boolean {
	if (record.type === "childList") return true;
	return record.target.instanceOf(HTMLElement) && record.target.classList.contains(HARNESS);
}

function relayoutOverlaps(container: HTMLElement): void {
	if (container.classList.contains(cls("custom-overlapping-event-width"))) markForwardHarnesses(container);
	else for (const harness of harnessesIn(container)) toggleCls(harness, "overlap-forward", false);
	markCoveredHarnesses(container);
}

function clearOverlapMarks(container: HTMLElement): void {
	for (const harness of harnessesIn(container)) {
		harness.classList.remove(FORWARD, COVERED);
		harness.querySelector<HTMLElement>(`.${CONTENT}`)?.style.removeProperty(VISIBLE_WIDTH_VAR);
	}
}

function harnessesIn(root: ParentNode): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(`.${HARNESS}`));
}

// FullCalendar puts `-inset` on every placed harness, so its inline percentages are the only
// signal: the forward event reaches the far edge from a non-zero near edge. Drag mirrors are
// positioned in px, so they never qualify.
export function markForwardHarnesses(container: HTMLElement): void {
	for (const harness of harnessesIn(container)) {
		const rtl = harness.closest(".fc-direction-rtl") !== null;
		const near = rtl ? harness.style.right : harness.style.left;
		const far = rtl ? harness.style.left : harness.style.right;
		const isForward = near.endsWith("%") && Number.parseFloat(near) > 0 && Number.parseFloat(far) === 0;
		toggleCls(harness, "overlap-forward", isForward);
	}
}

/** One event in a day column, in px, with the inline axis normalised so `start` is the near edge. */
export interface OverlapBox {
	top: number;
	bottom: number;
	start: number;
	end: number;
	/** Where the event's text ends when it has the event's full width. */
	textBottom: number;
}

/**
 * For each box, the width its text may use so no event drawn further forward sits on top of it —
 * or null when nothing covers its text. Forward events start further along the inline axis, which
 * is also what FullCalendar stacks above.
 */
export function computeVisibleTextWidths(boxes: readonly OverlapBox[]): (number | null)[] {
	return boxes.map((box) => {
		let visibleEnd = box.end;
		for (const other of boxes) {
			if (other === box || other.start <= box.start + EDGE_EPSILON_PX) continue;
			const coversText = other.top < box.textBottom - EDGE_EPSILON_PX && other.bottom > box.top + EDGE_EPSILON_PX;
			if (coversText) visibleEnd = Math.min(visibleEnd, other.start);
		}
		return visibleEnd < box.end - EDGE_EPSILON_PX ? visibleEnd - box.start : null;
	});
}

// The content wrapper stretches to the event's full height, so its last child is where the text ends.
function textBottomOf(harness: HTMLElement): number | null {
	const last = harness.querySelector<HTMLElement>(`.${CONTENT}`)?.lastElementChild;
	return last ? last.getBoundingClientRect().bottom : null;
}

// The event's border and FullCalendar's padding sit between the harness edge and our content.
function contentInset(harness: HTMLElement, content: HTMLElement, rtl: boolean): number {
	const outer = harness.getBoundingClientRect();
	const inner = content.getBoundingClientRect();
	return rtl ? outer.right - inner.right : inner.left - outer.left;
}

// Measure every column with its constraints lifted first, so where the text ends never depends
// on the previous pass.
function markCoveredHarnesses(container: HTMLElement): void {
	const columns = new Set(
		harnessesIn(container)
			.map((harness) => harness.parentElement)
			.filter((column): column is HTMLElement => column !== null)
	);
	for (const column of columns) {
		const harnesses = Array.from(column.children).filter(
			(el): el is HTMLElement =>
				el.instanceOf(HTMLElement) && el.classList.contains(HARNESS) && el.querySelector(".fc-event-mirror") === null
		);
		for (const harness of harnesses) harness.classList.remove(COVERED);

		const rtl = column.closest(".fc-direction-rtl") !== null;
		const boxes = harnesses.map((harness) => {
			const rect = harness.getBoundingClientRect();
			return {
				top: rect.top,
				bottom: rect.bottom,
				start: rtl ? -rect.right : rect.left,
				end: rtl ? -rect.left : rect.right,
				textBottom: Math.min(rect.bottom, textBottomOf(harness) ?? rect.bottom),
			};
		});

		computeVisibleTextWidths(boxes).forEach((visible, index) => {
			const harness = harnesses[index];
			const content = harness.querySelector<HTMLElement>(`.${CONTENT}`);
			if (visible === null) {
				content?.style.removeProperty(VISIBLE_WIDTH_VAR);
				return;
			}
			const inset = content ? contentInset(harness, content, rtl) : 0;
			const value = `${Math.max(0, Math.floor(visible - inset))}px`;
			if (content && content.style.getPropertyValue(VISIBLE_WIDTH_VAR) !== value) {
				content.style.setProperty(VISIBLE_WIDTH_VAR, value);
			}
			harness.classList.add(COVERED);
		});
	}
}
