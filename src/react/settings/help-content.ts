import type { GeneralHelpCenterConfig } from "@real1ty/obsidian-plugins-react";

import FAQ_CONTENT from "../../../docs-site/docs/faq.md";
import TROUBLESHOOTING_CONTENT from "../../../docs-site/docs/troubleshooting.md";

/**
 * Help Center content for Prisma Calendar. The FAQ and troubleshooting tabs
 * embed the plugin's own documentation pages — `faq.md` and `troubleshooting.md`
 * are bundled at build time (the same `.md` text loader the changelog uses) and
 * rendered as Markdown inside the modal. The docs site stays the single source of
 * truth, so the in-app help can never drift out of date. The Get-help tab offers
 * links (documentation / GitHub / feedback), wired from the General help config.
 */
export const PRISMA_HELP_CENTER: GeneralHelpCenterConfig = {
	faq: FAQ_CONTENT,
	troubleshooting: TROUBLESHOOTING_CONTENT,
};
