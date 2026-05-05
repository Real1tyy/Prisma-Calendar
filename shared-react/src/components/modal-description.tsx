import type { ReactNode } from "react";
import { memo } from "react";

export interface ModalDescriptionProps {
	children: ReactNode;
	testId?: string;
}

export const ModalDescription = memo(function ModalDescription({ children, testId }: ModalDescriptionProps) {
	return (
		<p
			className="modal-description"
			style={{ color: "var(--text-muted)" }}
			{...(testId ? { "data-testid": testId } : {})}
		>
			{children}
		</p>
	);
});
