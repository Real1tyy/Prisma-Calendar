/**
 * Interface for CSS utility functions created by the factory.
 */
export interface CssUtils {
	/**
	 * Prefixes class names with the plugin prefix.
	 * Handles multiple class names and automatically adds the prefix.
	 *
	 * @example
	 * cls("calendar-view") => "prefix-calendar-view"
	 * cls("button", "active") => "prefix-button prefix-active"
	 * cls("modal calendar") => "prefix-modal prefix-calendar"
	 */
	cls: (...classNames: string[]) => string;

	/**
	 * Adds prefixed class names to an element.
	 *
	 * @example
	 * addCls(element, "active", "selected")
	 */
	addCls: (element: HTMLElement, ...classNames: string[]) => void;

	/**
	 * Removes prefixed class names from an element.
	 *
	 * @example
	 * removeCls(element, "active", "selected")
	 */
	removeCls: (element: HTMLElement, ...classNames: string[]) => void;

	/**
	 * Toggles prefixed class names on an element.
	 *
	 * @example
	 * toggleCls(element, "active")
	 */
	toggleCls: (element: HTMLElement, className: string, force?: boolean) => boolean;

	/**
	 * Checks if element has a prefixed class.
	 *
	 * @example
	 * hasCls(element, "active")
	 */
	hasCls: (element: HTMLElement, className: string) => boolean;
}

/**
 * Creates a set of CSS utility functions with a custom prefix.
 * Use this factory to create plugin-specific CSS utilities.
 *
 * @param prefix - The CSS class prefix (e.g., "prisma-", "nexus-properties-")
 * @returns An object containing all CSS utility functions
 *
 * @example
 * // Create utilities for a specific plugin
 * const { cls, addCls, removeCls, toggleCls, hasCls } = createCssUtils("my-plugin-");
 *
 * cls("button") // => "my-plugin-button"
 * addCls(element, "active") // adds "my-plugin-active" to element
 */
export function createCssUtils(prefix: string): CssUtils {
	const cls = (...classNames: string[]): string => {
		return classNames
			.flatMap((name) => name.split(/\s+/))
			.filter((name) => name.length > 0)
			.map((name) => `${prefix}${name}`)
			.join(" ");
	};

	const addCls = (element: HTMLElement, ...classNames: string[]): void => {
		const classes = cls(...classNames);
		if (classes) {
			element.classList.add(...classes.split(/\s+/));
		}
	};

	const removeCls = (element: HTMLElement, ...classNames: string[]): void => {
		const classes = cls(...classNames);
		if (classes) {
			element.classList.remove(...classes.split(/\s+/));
		}
	};

	const toggleCls = (element: HTMLElement, className: string, force?: boolean): boolean => {
		return element.classList.toggle(cls(className), force);
	};

	const hasCls = (element: HTMLElement, className: string): boolean => {
		return element.classList.contains(cls(className));
	};

	return { cls, addCls, removeCls, toggleCls, hasCls };
}

// ============================================================================
// Default "prisma-" prefixed utilities for backwards compatibility
// ============================================================================

const DEFAULT_PREFIX = "prisma-";
const defaultUtils = createCssUtils(DEFAULT_PREFIX);

/**
 * Prefixes class names with the standard "prisma-" prefix.
 * Handles multiple class names and automatically adds the prefix.
 *
 * @example
 * cls("calendar-view") => "prisma-calendar-view"
 * cls("button", "active") => "prisma-button prisma-active"
 * cls("modal calendar") => "prisma-modal prisma-calendar"
 */
export const cls = defaultUtils.cls;

/**
 * Adds "prisma-" prefixed class names to an element.
 *
 * @example
 * addCls(element, "active", "selected")
 */
export const addCls = defaultUtils.addCls;

/**
 * Removes "prisma-" prefixed class names from an element.
 *
 * @example
 * removeCls(element, "active", "selected")
 */
export const removeCls = defaultUtils.removeCls;

/**
 * Toggles "prisma-" prefixed class names on an element.
 *
 * @example
 * toggleCls(element, "active")
 */
export const toggleCls = defaultUtils.toggleCls;

/**
 * Checks if element has a "prisma-" prefixed class.
 *
 * @example
 * hasCls(element, "active")
 */
export const hasCls = defaultUtils.hasCls;
