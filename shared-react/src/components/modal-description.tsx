import type { ReactNode } from "react";
import { memo } from "react";

import { testIdAttr } from "../utils/test-id";

export interface ModalDescriptionProps {
	children: ReactNode;
	testId?: string | undefined;
}

export const ModalDescription = memo(function ModalDescription({ children, testId }: ModalDescriptionProps) {
	return (
		<p className="modal-description" style={{ color: "var(--text-muted)" }} {...testIdAttr(testId)}>
			{children}
		</p>
	);
});
