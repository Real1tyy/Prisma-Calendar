import { formatChangeForDisplay, type FrontmatterChange, type FrontmatterDiff } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { memo } from "react";

import { useScoped, useScopedTid } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/styles/use-styles";
import { Button } from "../primitives/atoms/button";
import { openReactModal } from "../show-react-modal";
import { buildFrontmatterPropagationStyles } from "./frontmatter-propagation-modal.styles";

function DiffSection({ title, changes, cls }: { title: string; changes: FrontmatterChange[]; cls: string }) {
	if (changes.length === 0) return null;
	return (
		<div>
			<h4>{title}</h4>
			<ul>
				{changes.map((change) => (
					<li key={change.key} className={cls}>
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
}

export const FrontmatterPropagationModalContent = memo(function FrontmatterPropagationModalContent({
	sourceLabel,
	diff,
	targetCount,
	description,
	onConfirm,
	onCancel,
}: FrontmatterPropagationModalProps) {
	const { cls, cssPrefix } = useScoped("frontmatter");
	const tid = useScopedTid("frontmatter-propagation");
	useInjectedStyles(`${cssPrefix}frontmatter-propagation-styles`, buildFrontmatterPropagationStyles(cssPrefix));

	const defaultDescription = `"${sourceLabel}" has frontmatter changes. Propagate to ${targetCount} target${targetCount !== 1 ? "s" : ""}?`;

	return (
		<div data-testid={tid("modal")}>
			<p>{description ?? defaultDescription}</p>
			<div className={cls("changes")}>
				<DiffSection title="Added properties:" changes={diff.added} cls={`${cssPrefix}change-added`} />
				<DiffSection title="Modified properties:" changes={diff.modified} cls={`${cssPrefix}change-modified`} />
				<DiffSection title="Deleted properties:" changes={diff.deleted} cls={`${cssPrefix}change-deleted`} />
			</div>
			<div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
				<Button testId={tid("cancel")} onClick={onCancel}>
					No, skip
				</Button>
				<Button testId={tid("confirm")} onClick={onConfirm} variant="primary">
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
	/** CSS prefix propagated to `SharedReactThemeProvider`. */
	cssPrefix?: string;
	/** TestId prefix propagated to `SharedReactThemeProvider`. */
	testIdPrefix?: string;
}

export function openFrontmatterPropagationModal(
	app: App,
	options: OpenFrontmatterPropagationOptions
): Promise<boolean> {
	const testIdPrefix = options.testIdPrefix ?? options.cssPrefix ?? "";
	return openReactModal<boolean>({
		app,
		title: options.title ?? "Propagate frontmatter changes?",
		testId: `${testIdPrefix}frontmatter-propagation-modal-container`,
		...(options.cssPrefix !== undefined ? { cssPrefix: options.cssPrefix } : {}),
		testIdPrefix,
		render: (submit, cancel) => (
			<FrontmatterPropagationModalContent
				sourceLabel={options.sourceLabel}
				diff={options.diff}
				targetCount={options.targetCount}
				description={options.description}
				onConfirm={() => submit(true)}
				onCancel={() => cancel()}
			/>
		),
	}).then((result) => result ?? false);
}
