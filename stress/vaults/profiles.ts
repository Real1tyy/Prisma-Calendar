import type { VaultProfile } from "@real1ty-obsidian-plugins/testing/stress";

export interface PrismaVaultProfile extends VaultProfile {
	/** Vault subdirectory the calendar bundle indexes. */
	directory: string;
}

// Each profile generates `events` plain timed events + `recurring` recurring
// sources (open-ended, started years before the frozen anchor), so the indexer
// source count is exactly `events + recurring` — the deterministic gate the
// navigation spec waits on. Recurring sources expand to virtual instances on
// render, which is what drives `recurrence.expandVisibleRange`.

export const SMALL_PROFILE: PrismaVaultProfile = {
	name: "small",
	events: 500,
	recurring: 50,
	directory: "Events",
};

export const MEDIUM_PROFILE: PrismaVaultProfile = {
	name: "medium",
	events: 2000,
	recurring: 200,
	directory: "Events",
};

// Heavy tier — the user's call (agents stick to small/medium). 50k plain + 10k
// recurring sources reproduces a real power-user vault.
export const LARGE_PROFILE: PrismaVaultProfile = {
	name: "large",
	events: 50_000,
	recurring: 10_000,
	directory: "Events",
};

export const PROFILES = { small: SMALL_PROFILE, medium: MEDIUM_PROFILE, large: LARGE_PROFILE } as const;

export type ProfileName = keyof typeof PROFILES;
