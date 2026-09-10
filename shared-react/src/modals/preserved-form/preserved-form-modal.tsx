import type { App } from "obsidian";
import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { showReactModal } from "../../show-react-modal";
import { MinimizedModals } from "../minimized-modal-slot";
import { buildPreservedFormStyles } from "./preserved-form.styles";

/**
 * What the form's own markup is handed. The state is one object the plugin
 * defines — that is the whole contract: define the model, get preservation.
 */
export interface PreservedFormApi<State> {
	state: State;
	setState: Dispatch<SetStateAction<State>>;
	/** Sugar for the common `setState(s => ({ ...s, ...partial }))`. */
	patch: (partial: Partial<State>) => void;
	/** Throws the form's contents away — what the Clear control does. */
	clear: () => void;
	/**
	 * "Whatever happens next has already dealt with this state" — a submit that
	 * succeeded, or a flow taking the form over. Suppresses the preserve that
	 * leaving would otherwise do.
	 */
	finish: () => void;
	close: () => void;
}

export interface PreservedFormModalConfig<State> {
	app: App;
	/** Trailing-dash CSS prefix, e.g. `"prisma-"`. */
	cssPrefix: string;
	/** Kebab name — drives the modal class and the testid scope, e.g. `"feedback"`. */
	name: string;
	title?: string | undefined;
	/** What the shared minimized slot calls this form. One label per form kind. */
	label: string;
	/** A pristine form. Used for a fresh open and for Clear. */
	blank: () => State;
	/**
	 * Nothing the user would miss. A form that leaves empty is dropped rather
	 * than preserved — there would be nothing to come back to.
	 */
	isEmpty: (state: State) => boolean;
	/** Extra controls in the window row, left of Clear. */
	windowActions?: ((api: PreservedFormApi<State>) => ReactNode) | undefined;
	render: (api: PreservedFormApi<State>) => ReactNode;
	/** Fired when leaving actually preserved something — a plugin's chance to say so. */
	onPreserved?: ((state: State) => void) | undefined;
}

export interface ShellProps<State> {
	config: PreservedFormModalConfig<State>;
	seed: State;
	close: () => void;
	onDismiss: (state: State) => void;
}

export function PreservedFormShell<State>({ config, seed, close, onDismiss }: ShellProps<State>) {
	// A literal scope, not `config.name`: the class and testid names must be
	// discoverable by the static testid scanner from this file alone.
	const { cls, tid, cssPrefix } = useScoped("preserved-form");
	useInjectedStyles(`${cssPrefix}preserved-form-styles`, buildPreservedFormStyles(cssPrefix));

	const [state, setState] = useState<State>(seed);

	// The unmount handler runs once, long after this render's closures are stale,
	// so it reads the form through a ref rather than capturing it.
	const latest = useRef(state);
	// Mirrored in an effect, not during render: the cleanup below runs after the
	// last commit, so the last committed state is exactly what it needs to see.
	useEffect(() => {
		latest.current = state;
	}, [state]);
	// Deliberately a second ref: `latest` is rewritten on every render, so a flag
	// stored beside it would be undone by the next one.
	const handled = useRef(false);

	const patch = useCallback((partial: Partial<State>) => setState((current) => ({ ...current, ...partial })), []);
	const finish = useCallback(() => {
		handled.current = true;
	}, []);
	const blank = config.blank;
	const clear = useCallback(() => setState(blank()), [blank]);

	// Escape, a click outside, the close button — every one of them ends as an
	// unmount, which is what makes "leaving never costs you your work" a property
	// of the form rather than of the particular control the user pressed
	// ([[knowledge-preserved-form-state]]).
	useEffect(
		() => () => {
			if (!handled.current) onDismiss(latest.current);
		},
		[onDismiss]
	);

	const api: PreservedFormApi<State> = { state, setState, patch, clear, finish, close };

	return (
		<>
			<div className={cls("window-actions")} data-testid={tid("window-actions")}>
				{/* eslint-disable-next-line react-hooks/refs -- `api` carries `finish`, which writes the `handled` ref; consumers only ever call it from an event handler, and the rule cannot see that through the render callback */}
				{config.windowActions?.(api)}
				{/* The only control that discards. Everything else keeps the form. */}
				<button
					type="button"
					className={cls("window-action")}
					aria-label="Clear"
					title="Clear this form — every other way out keeps it"
					onClick={clear}
					data-testid={tid("clear")}
				>
					Clear
				</button>
			</div>
			{/* eslint-disable-next-line react-hooks/refs -- same as above: `finish` is an event-handler callback, never invoked during render */}
			{config.render(api)}
		</>
	);
}

export interface PreservedFormHandle {
	/** Closes without preserving — the form has already been dealt with. */
	close: () => void;
}

/**
 * Opens a modal whose form survives being left.
 *
 * The plugin supplies its state model, a blank, an emptiness test and the
 * markup; preservation, restoration and the Clear control come with the mount.
 * See [[knowledge-preserved-form-state]] for the convention this implements and
 * [[decision-component-renderer]] for why UI is mounted rather than constructed.
 */
export function openPreservedFormModal<State>(
	config: PreservedFormModalConfig<State>,
	seed?: State
): PreservedFormHandle {
	// Opening a form of a kind that is already parked surfaces the parked one
	// rather than replacing it: the user asking for the form again is asking for
	// what they were writing, and Clear is how they say otherwise. An explicit
	// seed means the caller already knows which report this is (a restore, a
	// capture round-trip) and decides for itself.
	const parked = seed === undefined ? preservedFormState<State>(config.label) : null;
	if (parked !== null) MinimizedModals.clear();

	const onDismiss = (state: State): void => {
		if (config.isEmpty(state)) return;
		MinimizedModals.save<State>({
			label: config.label,
			state,
			restore: (preserved) => openPreservedFormModal(config, preserved),
		});
		config.onPreserved?.(state);
	};

	let close = (): void => {};
	let closed = false;
	showReactModal({
		app: config.app,
		cls: `${config.cssPrefix}${config.name}-modal`,
		cssPrefix: config.cssPrefix,
		testIdPrefix: config.cssPrefix,
		...(config.title !== undefined ? { title: config.title } : {}),
		render: (closeModal) => {
			close = closeModal;
			return (
				<PreservedFormShell
					config={config}
					seed={seed ?? parked ?? config.blank()}
					close={closeModal}
					onDismiss={onDismiss}
				/>
			);
		},
	});

	// Closing twice would unmount a root that is already gone: the user's own
	// Escape and a programmatic close can race for the same modal.
	return {
		close: () => {
			if (closed) return;
			closed = true;
			close();
		},
	};
}

/** Whether a form of this kind is parked — what a restore command gates on. */
export function hasPreservedForm(label: string): boolean {
	return MinimizedModals.label() === label;
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the state type it parked, exactly as `MinimizedModals.get` does; the single slot is untyped at rest, so this is a checked-by-convention read, not a relationship the signature could express
export function preservedFormState<State>(label: string): State | null {
	const entry = MinimizedModals.get<State>();
	return entry?.label === label ? entry.state : null;
}

/** Re-opens the parked form. Returns false when there was nothing to restore. */
export function restorePreservedForm(label: string): boolean {
	if (!hasPreservedForm(label)) return false;
	MinimizedModals.restore();
	return true;
}
