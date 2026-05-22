import type { VaultProfile } from "@real1ty-obsidian-plugins/testing/stress";

export interface PrismaVaultProfile extends VaultProfile {
	/** Vault subdirectory the calendar bundle indexes. */
	directory: string;
}

// M1 profiles generate plain timed events (no recurrence) so the indexer count
// is exactly `events` — the deterministic gate the navigation spec waits on.
// Recurrence-heavy profiles arrive with the recurrence scenario (later milestone).

export const SMALL_PROFILE: PrismaVaultProfile = {
	name: "small",
	events: 500,
	recurring: 0,
	directory: "Events",
};

export const MEDIUM_PROFILE: PrismaVaultProfile = {
	name: "medium",
	events: 2000,
	recurring: 0,
	directory: "Events",
};

export const PROFILES = { small: SMALL_PROFILE, medium: MEDIUM_PROFILE } as const;

export type ProfileName = keyof typeof PROFILES;
