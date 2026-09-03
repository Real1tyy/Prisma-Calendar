import { CollapsibleSection } from "@real1ty/obsidian-plugins-react";
import { memo, type ReactNode } from "react";

// Device-local, so a user who has read an explanation is not shown it again on this
// machine. Namespaced per plugin — every plugin shares one localStorage origin.
const HELP_STORAGE_PREFIX = "prisma-calendar:settings:";

interface HelpBoxProps {
	label: string;
	/** Unique across every settings tab: it keys both the stored flag and the testid. */
	slug: string;
	children: ReactNode;
}

/**
 * A standing explanation on a settings tab: worth reading once, clutter above the controls
 * forever after. Each folds away under its own remembered key.
 *
 * Deliberately no `settings-info-box` wrapper — `CollapsibleSection` already paints the
 * panel these boxes used to paint themselves (same border, same `--background-secondary`),
 * so nesting the two renders a box inside an identical box.
 */
export const HelpBox = memo(function HelpBox({ label, slug, children }: HelpBoxProps) {
	return (
		<CollapsibleSection label={label} storageKey={`${HELP_STORAGE_PREFIX}${slug}`} testIdSlug={`${slug}-help`}>
			{children}
		</CollapsibleSection>
	);
});
