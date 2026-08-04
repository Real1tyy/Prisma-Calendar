const ITEM_CLASS = "setting-item";
const HEADING_CLASS = "setting-item-heading";

interface Group {
	heading: HTMLElement | null;
	blocks: HTMLElement[];
}

function matches(el: Element, query: string): boolean {
	return (el.textContent ?? "").toLowerCase().includes(query);
}

function setHidden(el: Element, hidden: boolean, hiddenClass: string): void {
	el.classList.toggle(hiddenClass, hidden);
}

/** Un-hide a block and everything under it, clearing markers a prior query left behind. */
function reveal(el: Element, hiddenClass: string): void {
	el.classList.remove(hiddenClass);
	el.querySelectorAll(`.${hiddenClass}`).forEach((descendant) => descendant.classList.remove(hiddenClass));
}

/** Split a container's children into heading-delimited groups, preserving order. */
function toGroups(children: HTMLElement[]): Group[] {
	const groups: Group[] = [{ heading: null, blocks: [] }];
	for (const child of children) {
		if (child.classList.contains(HEADING_CLASS)) groups.push({ heading: child, blocks: [] });
		else groups[groups.length - 1].blocks.push(child);
	}
	return groups;
}

function filterGroup(group: Group, query: string, hiddenClass: string): boolean {
	// A heading match is a match for its whole section: the rows under "Event
	// colors" read "Category.includes('Health')" and would otherwise vanish out
	// from under the very heading the query found.
	if (group.heading && matches(group.heading, query)) {
		reveal(group.heading, hiddenClass);
		for (const block of group.blocks) reveal(block, hiddenClass);
		return true;
	}

	let anyVisible = false;
	for (const block of group.blocks) {
		const visible = filterBlock(block, query, hiddenClass);
		setHidden(block, !visible, hiddenClass);
		anyVisible ||= visible;
	}
	if (group.heading) setHidden(group.heading, !anyVisible, hiddenClass);
	return anyVisible;
}

function filterBlock(block: HTMLElement, query: string, hiddenClass: string): boolean {
	// `.setting-item` is atomic — its own text is the whole question. So is any
	// block with no settings beneath it: an info box, a blurb, a rule/preset
	// row, an account row, a chart. Everything else wraps settings — recurse,
	// and it survives only if something inside it does.
	if (block.classList.contains(ITEM_CLASS)) return matches(block, query);
	if (!block.querySelector(`.${ITEM_CLASS}`)) return matches(block, query);
	return filterContainer(block, query, hiddenClass);
}

function filterContainer(node: HTMLElement, query: string, hiddenClass: string): boolean {
	const children = Array.from(node.children) as HTMLElement[];
	if (children.length === 0) return matches(node, query);

	return toGroups(children).reduce<boolean>(
		(anyVisible, group) => filterGroup(group, query, hiddenClass) || anyVisible,
		false
	);
}

/**
 * Hide everything under `scope` that the query does not reach, and report
 * whether anything survived.
 *
 * Every block answers to the query, not just `.setting-item` rows — a settings
 * tab is mostly info boxes, blurbs, rule/preset rows, account rows and charts,
 * and leaving those unfilterable dumped all of them on screen for any query
 * ([[review-settings-search-hides-only-setting-items]]).
 *
 * `query` must already be lower-cased and trimmed.
 */
export function applySettingsSearchFilter(scope: HTMLElement, query: string, hiddenClass: string): boolean {
	// The scope is always a container, never an atomic block — otherwise a tab
	// holding no `.setting-item` at all (an upgrade banner, a pure info page)
	// would be judged as a whole and never filtered.
	return filterContainer(scope, query, hiddenClass);
}

export function clearSettingsSearchFilter(scope: HTMLElement, hiddenClass: string): void {
	scope.querySelectorAll(`.${hiddenClass}`).forEach((el) => el.classList.remove(hiddenClass));
}
