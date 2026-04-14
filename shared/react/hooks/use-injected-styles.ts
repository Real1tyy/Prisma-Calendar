import { useEffect } from "react";

import { injectStyleSheet } from "../../utils/styles/inject";

/**
 * Inject a stylesheet into `document.head` once per id on mount. Idempotent —
 * safe to call from multiple components referencing the same id.
 *
 * Used by React ports of imperative DSLs so they carry their own baseline
 * styling and don't depend on the imperative component being rendered first.
 */
export function useInjectedStyles(id: string, css: string): void {
	useEffect(() => {
		injectStyleSheet(id, css);
	}, [id, css]);
}
