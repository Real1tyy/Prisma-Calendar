import "obsidian";

// Obsidian ships no types for the internal settings modal surface. We only need
// `close()` (to dismiss settings before launching the onboarding tour so the
// spotlight isn't hidden behind the modal); `open`/`openTabById` are included to
// match the runtime shape.
declare module "obsidian" {
	interface App {
		setting: {
			open(): void;
			close(): void;
			openTabById(id: string): void;
		};
	}
}
