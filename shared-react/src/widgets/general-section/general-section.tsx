import { buildUtmUrl, type LicenseManager, type PluginSlug } from "@real1ty/obsidian-plugins";
import { memo, type ReactNode } from "react";

import { OutboundLink } from "../../primitives/atoms/outbound-link";
import { SettingCard, SettingHeading, SettingItem } from "../../primitives/layout/setting-item";
import { SettingsTransferButtons, type SettingsTransferButtonsProps } from "../../settings/settings-transfer";
import { testIdAttr } from "../../utils/test-id";
import { LicenseSection } from "../license-section/license-section";

// Every outbound link in the General surface is attributed to the same source +
// medium so the only thing a consumer (or sub-section) varies is the per-link
// `utm_content` tag. Centralising this is the whole point of routing UTM through
// `GeneralSection` instead of each plugin hand-building query strings.
const GENERAL_UTM_SOURCE = "plugin";
const GENERAL_UTM_MEDIUM = "settings";

/** Shared toggle every sub-section honours. The default differs per section. */
interface ToggleableConfig {
	/**
	 * Whether the sub-section renders. The universal three (help, changelog,
	 * settings transfer) default to `true`; license defaults to `false` and is
	 * opt-in, so it must be set explicitly to `true` to appear.
	 */
	enabled?: boolean;
}

export interface GeneralHelpConfig extends ToggleableConfig {
	/** Short plugin name woven into the intro copy, e.g. `"Prisma"`. */
	pluginDisplayName: string;
	/** Documentation home URL (no UTM — the section appends it). */
	documentationUrl: string;
	/** Optional FAQ page URL. */
	faqUrl?: string;
	/** Optional troubleshooting page URL. */
	troubleshootingUrl?: string;
	/** "New issue" URL for the plugin's GitHub repo. */
	githubIssuesUrl: string;
	/** Optional contact/feedback page URL. */
	feedbackUrl?: string;
	/** Optional Pro upsell paragraph. */
	pro?: {
		/** Link text for the product page, e.g. `"Prisma Pro"`. */
		productName: string;
		/** Product/landing page URL (no UTM). */
		productPageUrl: string;
		/** Verb phrase completing "{productName} {pitch}", e.g. "unlocks …". */
		pitch: string;
	};
}

export interface GeneralChangelogConfig extends ToggleableConfig {
	/** Opens the changelog / what's-new surface. The plugin owns the modal. */
	onView: () => void;
	/** Button label. Default: `"View changelog"`. */
	buttonLabel?: string;
	/** Row heading. Default: `"Changelog"`. */
	name?: string;
	/** Row description. */
	description?: string;
}

export type GeneralSettingsTransferConfig<T extends Record<string, unknown>> = ToggleableConfig &
	Omit<SettingsTransferButtonsProps<T>, "testIdPrefix">;

export interface GeneralLicenseConfig extends ToggleableConfig {
	licenseManager: LicenseManager;
	currentSecretName: string;
	onSecretChange: (value: string) => Promise<void>;
	/**
	 * Fixed keychain id for the one-click paste-and-activate flow. When set, the
	 * License key row lets the user paste their key and Activate in one step (the
	 * secret is created behind the scenes); the manual secret-picker stays behind
	 * an advanced toggle. Omit to render only the secret-picker.
	 */
	licenseSecretId?: string;
	activationGuideUrl?: string;
	accountUrls?: {
		subscription: string;
		billing: string;
		devices: string;
	};
}

/**
 * A universal sub-section registered by another spec (logging, doctor, …) so it
 * can plug into the General surface without editing this component. Rendered in
 * array order between the plugin's own `children` and the settings-transfer row.
 */
export interface GeneralSubSection {
	/** Stable id used as the React key (and for host-side dedup/ordering). */
	id: string;
	/** The sub-section's rendered content (its own heading + rows). */
	node: ReactNode;
}

export interface GeneralSectionProps<T extends Record<string, unknown> = Record<string, unknown>> {
	/** Plugin slug — drives `utm_campaign` for every outbound link. */
	slug: PluginSlug;
	/**
	 * Stamped onto each sub-section's testid (`${testIdPrefix}help`,
	 * `${testIdPrefix}changelog-btn`, …) and threaded into the settings-transfer
	 * buttons. Omit to emit no testids.
	 */
	// Every optional prop below spells `| undefined` because callers thread a
	// possibly-undefined override through rather than omitting the key, and
	// exactOptionalPropertyTypes rejects the bare `?:` form for that.
	testIdPrefix?: string | undefined;
	/** Help & support card. Default-on; pass `enabled: false` to hide. */
	help?: GeneralHelpConfig | undefined;
	/** Changelog row. Default-on; pass `enabled: false` to hide. */
	changelog?: GeneralChangelogConfig | undefined;
	/** Import/export/reset row. Default-on; pass `enabled: false` to hide. */
	settingsTransfer?: GeneralSettingsTransferConfig<T> | undefined;
	/** License card. Opt-in — only renders when `enabled: true`. */
	license?: GeneralLicenseConfig | undefined;
	/** Universal sub-sections registered by other specs (logging, doctor). */
	extraSections?: GeneralSubSection[] | undefined;
	/**
	 * Stable slot for cross-cutting action buttons (rating, feedback). The
	 * container always renders so future specs can fill it without restructuring
	 * this component.
	 */
	actions?: ReactNode;
	/** Plugin-specific sub-sections composed between license and the bottom rows. */
	children?: ReactNode;
}

function isOn(config: ToggleableConfig | undefined, defaultEnabled: boolean): boolean {
	if (config === undefined) return false;
	return config.enabled ?? defaultEnabled;
}

/** Drop the `enabled` gate so the rest forwards cleanly to `SettingsTransferButtons`. */
function stripToggle<T extends Record<string, unknown>>(
	config: GeneralSettingsTransferConfig<T>
): Omit<SettingsTransferButtonsProps<T>, "testIdPrefix"> {
	const { enabled: _enabled, ...rest } = config;
	return rest;
}

function HelpAndSupport({
	config,
	slug,
	testId,
}: {
	config: GeneralHelpConfig;
	slug: PluginSlug;
	testId?: string | undefined;
}): ReactNode {
	const utm = (url: string, content: string): string =>
		buildUtmUrl(url, slug, GENERAL_UTM_SOURCE, GENERAL_UTM_MEDIUM, content);
	const { faqUrl, troubleshootingUrl, feedbackUrl, pro } = config;

	return (
		<>
			<SettingHeading name="Help & support" />
			<SettingCard testId={testId}>
				<p>
					{`Thanks for trying ${config.pluginDisplayName}. I hope it helps you stay productive and organized inside Obsidian.`}
				</p>
				<p>
					Have a question? The{" "}
					<OutboundLink href={utm(config.documentationUrl, "help_documentation")}>
						<strong>documentation</strong>
					</OutboundLink>{" "}
					covers most topics — use the search bar to quickly find what you need.
					{(faqUrl !== undefined || troubleshootingUrl !== undefined) && " Check the "}
					{faqUrl !== undefined && (
						<OutboundLink href={utm(faqUrl, "help_faq")}>
							<strong>frequently asked questions</strong>
						</OutboundLink>
					)}
					{faqUrl !== undefined && troubleshootingUrl !== undefined && " or "}
					{troubleshootingUrl !== undefined && (
						<OutboundLink href={utm(troubleshootingUrl, "help_troubleshooting")}>
							<strong>troubleshooting</strong>
						</OutboundLink>
					)}
					{(faqUrl !== undefined || troubleshootingUrl !== undefined) && " pages for common issues."}
				</p>
				<p>
					Spotted a bug or have an idea to improve it? Please{" "}
					<OutboundLink href={utm(config.githubIssuesUrl, "help_github")}>
						<strong>open a GitHub issue</strong>
					</OutboundLink>
					{feedbackUrl !== undefined && (
						<>
							{" or reach me through the "}
							<OutboundLink href={utm(feedbackUrl, "help_feedback")}>
								<strong>feedback page</strong>
							</OutboundLink>
						</>
					)}
					. I'd love to hear your thoughts.
				</p>
				{pro !== undefined && (
					<p>
						For more connected, advanced workflows,{" "}
						<OutboundLink href={utm(pro.productPageUrl, "help_pro")}>
							<strong>{pro.productName}</strong>
						</OutboundLink>{" "}
						{pro.pitch}{" "}
						<OutboundLink href={utm(pro.productPageUrl, "help_free_trial")}>
							<strong>Try every Pro feature with a 30-day free trial</strong>
						</OutboundLink>{" "}
						— cancel anytime.
					</p>
				)}
			</SettingCard>
		</>
	);
}

function ChangelogRow({
	config,
	fieldTestId,
	buttonTestId,
}: {
	config: GeneralChangelogConfig;
	fieldTestId?: string | undefined;
	buttonTestId?: string | undefined;
}): ReactNode {
	return (
		<SettingItem
			name={config.name ?? "Changelog"}
			description={config.description ?? "Browse the full changelog with every update since the first release"}
			testId={fieldTestId}
		>
			<button type="button" onClick={config.onView} {...testIdAttr(buttonTestId)}>
				{config.buttonLabel ?? "View changelog"}
			</button>
		</SettingItem>
	);
}

/**
 * The consistent "General" settings surface every plugin mounts. Sub-sections
 * are independently toggleable via discrete, typed config objects; the universal
 * three (help, changelog, settings transfer) render by default while the license
 * card is opt-in. Plugin-specific sub-sections compose via `children`; future
 * cross-cutting buttons mount in the `actions` slot; other specs register extra
 * universal sub-sections via `extraSections`. Every outbound link is attributed
 * through `buildUtmUrl` internally so no consumer hand-builds a UTM string.
 */
function GeneralSectionInner<T extends Record<string, unknown>>({
	slug,
	testIdPrefix,
	help,
	changelog,
	settingsTransfer,
	license,
	extraSections,
	actions,
	children,
}: GeneralSectionProps<T>): ReactNode {
	const tid = (suffix: string): string | undefined =>
		testIdPrefix !== undefined ? `${testIdPrefix}${suffix}` : undefined;

	const transferTestId = tid("transfer");

	return (
		<>
			{isOn(license, false) && license !== undefined && (
				<LicenseSection
					licenseManager={license.licenseManager}
					currentSecretName={license.currentSecretName}
					onSecretChange={license.onSecretChange}
					{...(license.licenseSecretId !== undefined ? { licenseSecretId: license.licenseSecretId } : {})}
					{...(license.activationGuideUrl !== undefined ? { activationGuideUrl: license.activationGuideUrl } : {})}
					{...(license.accountUrls !== undefined ? { accountUrls: license.accountUrls } : {})}
				/>
			)}

			{children}

			{extraSections?.map((section) => (
				<div key={section.id}>{section.node}</div>
			))}

			{isOn(settingsTransfer, true) && settingsTransfer !== undefined && (
				<>
					<SettingHeading name="Settings transfer" />
					<SettingsTransferButtons
						{...stripToggle(settingsTransfer)}
						{...(transferTestId !== undefined ? { testIdPrefix: transferTestId } : {})}
					/>
				</>
			)}

			{isOn(help, true) && help !== undefined && <HelpAndSupport config={help} slug={slug} testId={tid("help")} />}

			{isOn(changelog, true) && changelog !== undefined && (
				<ChangelogRow config={changelog} fieldTestId={tid("field-changelog")} buttonTestId={tid("changelog-btn")} />
			)}

			<div {...testIdAttr(tid("general-actions"))}>{actions}</div>
		</>
	);
}

export const GeneralSection = memo(GeneralSectionInner) as typeof GeneralSectionInner;
