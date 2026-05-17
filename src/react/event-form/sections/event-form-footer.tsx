import { memo } from "react";

export interface EventFormFooterProps {
	mode: "create" | "edit";
	onCancel: () => void;
	onSavePreset?: (() => void) | undefined;
	onSubmit: () => void;
}

export const EventFormFooter = memo(function EventFormFooter({
	mode,
	onCancel,
	onSavePreset,
	onSubmit,
}: EventFormFooterProps) {
	return (
		<div className="prisma-event-modal-footer">
			<div className="prisma-modal-button-container">
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
