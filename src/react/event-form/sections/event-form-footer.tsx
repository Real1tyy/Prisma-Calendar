import { ObsidianIcon } from "@real1ty/obsidian-plugins-react";
import { memo } from "react";

export interface EventFormFooterProps {
	mode: "create" | "edit";
	onCancel: () => void;
	onSavePreset?: (() => void) | undefined;
	onSubmit: () => void;
	onJumpToTop?: (() => void) | undefined;
}

export const EventFormFooter = memo(function EventFormFooter({
	mode,
	onCancel,
	onSavePreset,
	onSubmit,
	onJumpToTop,
}: EventFormFooterProps) {
	return (
		<div className="prisma-event-modal-footer">
			<div className="prisma-modal-button-container">
				{onJumpToTop && (
					<button
						type="button"
						className="prisma-event-modal-jump-content-button"
						onClick={onJumpToTop}
						title="Back to event details"
						aria-label="Back to event details"
						data-testid="prisma-event-btn-jump-top"
					>
						<ObsidianIcon icon="chevron-up" />
					</button>
				)}
				<button type="button" onClick={onCancel} data-testid="prisma-event-btn-cancel">
					Cancel
				</button>
				{onSavePreset && (
					<button type="button" onClick={onSavePreset} data-testid="prisma-event-btn-save-preset">
						Save as preset
					</button>
				)}
				<button type="button" className="prisma-mod-cta" onClick={onSubmit} data-testid="prisma-event-btn-save">
					{mode === "create" ? "Create" : "Save"}
				</button>
			</div>
		</div>
	);
});
