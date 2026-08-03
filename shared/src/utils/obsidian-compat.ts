import { requireApiVersion, type ButtonComponent, type SliderComponent } from "obsidian";

/**
 * Compatibility shims for Obsidian APIs that 1.13 deprecated in favour of
 * replacements it also introduced in 1.13.
 *
 * Every plugin here pins a `minAppVersion` below 1.13, so neither the old nor
 * the new call is correct on its own: the replacement does not exist for our
 * users, and the deprecated one is flagged against the 1.13 type definitions we
 * now compile against. Each shim picks the right call at runtime.
 *
 * The casts go through `unknown` to a local structural type on purpose — that
 * keeps Obsidian's deprecated declaration out of the call graph, so the
 * deprecation is resolved rather than suppressed. Collapse each shim to its
 * modern call once every plugin's floor reaches 1.13.
 */

interface DestructiveCapable {
	setDestructive?: () => unknown;
	setWarning?: () => unknown;
}

interface DynamicTooltipCapable {
	setDynamicTooltip?: () => unknown;
}

/** Style a button as destructive — `setDestructive()` on 1.13+, `setWarning()` below. */
export function markDestructive(button: ButtonComponent): ButtonComponent {
	const candidate = button as unknown as DestructiveCapable;
	(candidate.setDestructive ?? candidate.setWarning)?.call(candidate);
	return button;
}

/**
 * Surface a slider's current value. 1.13 always renders it inline and ignores
 * `setDynamicTooltip()`; below 1.13 the tooltip is the only affordance, and
 * dropping the call would silently lose it.
 */
export function showSliderValue(slider: SliderComponent): SliderComponent {
	if (requireApiVersion("1.13.0")) return slider;
	(slider as unknown as DynamicTooltipCapable).setDynamicTooltip?.();
	return slider;
}
