import type { FrontmatterChange, FrontmatterDiff } from "@real1ty-obsidian-plugins";
import { formatChangeForDisplay } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { memo } from "react";

import { Button } from "../components/button";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { openReactModal } from "../show-react-modal";

function buildFrontmatterPropagationStyles(p: string): string {
	return `
.${p}-frontmatter-changes { margin: 1rem 0; }
.${p}-frontmatter-changes h4 { margin: 0.75rem 0 0.25rem; font-size: var(--font-ui-small); color: var(--text-muted); }
.${p}-frontmatter-changes ul { padding-left: 1.5rem; margin: 0; }
.${p}-frontmatter-changes li { margin-bottom: 0.25rem; line-height: 1.5; }
.${p}-change-added { color: var(--text-success); }
.${p}-change-modified { color: var(--text-accent); }
.${p}-change-deleted { color: var(--text-error); }
`;
}

function DiffSection({ title, changes, cls }: { title: string; changes: FrontmatterChange[]; cls: string }) {
	if (changes.length === 0) return null;
	return (
		<div>
			<h4>{title}</h4>
			<ul>
				{changes.map((change, i) => (
					<li key={i} className={cls}>
						{formatChangeForDisplay(change)}
					</li>
				))}
			</ul>
		</div>
	);
}

export interface FrontmatterPropagationModalProps {
	sourceLabel: string;
	diff: FrontmatterDiff;
	targetCount: number;
	description?: string | undefined;
	onConfirm: () => void;
	onCancel: () => void;
	cssPrefix?: string | undefined;
	testIdPrefix?: string | undefined;
}

export const FrontmatterPropagationModalContent = memo(function FrontmatterPropagationModalContent({
	sourceLabel,
	diff,
	targetCount,
	description,
	onConfirm,
	onCancel,
	cssPrefix = "frontmatter-propagation",
	testIdPrefix = "",
}: FrontmatterPropagationModalProps) {
	useInjectedStyles(`${cssPrefix}-frontmatter-propagation-styles`, buildFrontmatterPropagationStyles(cssPrefix));

	const defaultDescription = `"${sourceLabel}" has frontmatter changes. Propagate to ${targetCount} target${targetCount !== 1 ? "s" : ""}?`;

	return (
		<div data-testid={`${testIdPrefix}frontmatter-propagation-modal`}>
			<p>{description ?? defaultDescription}</p>
			<div className={`${cssPrefix}-frontmatter-changes`}>
				<DiffSection title="Added properties:" changes={diff.added} cls={`${cssPrefix}-change-added`} />
				<DiffSection title="Modified properties:" changes={diff.modified} cls={`${cssPrefix}-change-modified`} />
				<DiffSection title="Deleted properties:" changes={diff.deleted} cls={`${cssPrefix}-change-deleted`} />
			</div>
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={`${testIdPrefix}frontmatter-propagation-cancel`} onClick={onCancel}>
					No, skip
				</Button>
				<Button testId={`${testIdPrefix}frontmatter-propagation-confirm`} onClick={onConfirm} variant="primary">
					Yes, propagate
				</Button>
			</div>
		</div>
	);
});

export interface OpenFrontmatterPropagationOptions {
	sourceLabel: string;
	diff: FrontmatterDiff;
	targetCount: number;
	description?: string;
	title?: string;
	cssPrefix?: string;
	testIdPrefix?: string;
}

export function openFrontmatterPropagationModal(
	app: App,
	options: OpenFrontmatterPropagationOptions
): Promise<boolean> {
	const testIdPrefix = options.testIdPrefix ?? "";
	return openReactModal<boolean>({
		app,
		title: options.title ?? "Propagate frontmatter changes?",
		testId: `${testIdPrefix}frontmatter-propagation-modal-container`,
		render: (submit, cancel) => (
			<FrontmatterPropagationModalContent
				sourceLabel={options.sourceLabel}
				diff={options.diff}
				targetCount={options.targetCount}
				description={options.description}
				cssPrefix={options.cssPrefix}
				testIdPrefix={testIdPrefix}
				onConfirm={() => submit(true)}
				onCancel={() => cancel()}
			/>
		),
	}).then((result) => result ?? false);
}
