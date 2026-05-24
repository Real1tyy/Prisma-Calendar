/**
 * A monotonically-increasing source of ordering stamps.
 *
 * Hand the *same* instance to several {@link CommandManager}s when a caller owns
 * more than one history (e.g. one per calendar) and needs to know which was
 * mutated most recently — comparing their `lastActivityOrder` then yields a
 * strict global order across exactly those managers. Managers that don't share
 * a sequencer count on independent scales and are not comparable, which is the
 * correct default (an unrelated history's activity must not appear "newer").
 *
 * A counter rather than a timestamp: wall-clock values collide within a
 * millisecond, so two operations in the same tick would tie.
 */
export interface Sequencer {
	next(): number;
}

export function createMonotonicSequencer(): Sequencer {
	let value = 0;
	return {
		next: () => ++value,
	};
}
