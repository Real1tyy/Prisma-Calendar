import { memo } from "react";

import { cls } from "../../constants";

/**
 * The collapsed phone header's only control, mounted in the view header beside the
 * capacity readout so the collapsed calendar spends no row of its own. Always in the
 * DOM; CSS shows it only while the visible calendar's header is collapsed.
 * Shares the toolbar chevron's testid — it is the same toggle, in its collapsed home.
 * See [[spec-mobile-calendar-header-row-economy]].
 */
export const HeaderExpandChevron = memo(function HeaderExpandChevron({ onExpand }: { onExpand: () => void }) {
	return (
		<button
			type="button"
			className={cls("header-expand-chevron")}
			aria-label="Show calendar header"
			data-testid="prisma-cal-toolbar-header-collapse"
			onClick={onExpand}
		>
			▾
		</button>
	);
});
