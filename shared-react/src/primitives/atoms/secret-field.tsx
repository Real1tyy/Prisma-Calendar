import { SecretComponent } from "obsidian";
import { memo, useEffect, useRef } from "react";

import { useApp } from "../../contexts/app-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { testIdAttr } from "../../utils/test-id";

interface SecretFieldProps {
	/**
	 * The secret ID (not the secret value). Actual credentials live in the OS
	 * keychain via `app.secretStorage.setSecret(id, credential)`; the plugin's
	 * settings file only stores the ID so nothing sensitive hits `data.json`.
	 */
	value: string;
	onChange: (id: string) => void;
	testId?: string | undefined;
}

/**
 * React wrapper around Obsidian's imperative `SecretComponent`. Requires an
 * `<AppContext>` ancestor (already provided by `renderReactInline` /
 * `ReactModal` / `registerReactView`).
 */
export const SecretField = memo(function SecretField({ value, onChange, testId }: SecretFieldProps) {
	useInjectedStyles("setting-secret-host-styles", ".setting-secret-host { display: contents; }");
	const app = useApp();
	const containerRef = useRef<HTMLSpanElement>(null);
	const componentRef = useRef<SecretComponent | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const initialValueRef = useRef(value);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const component = new SecretComponent(app, el)
			.setValue(initialValueRef.current)
			.onChange((next) => onChangeRef.current(next));
		componentRef.current = component;
		return () => {
			el.replaceChildren();
			componentRef.current = null;
		};
		// Mount once; value changes are forwarded via the setValue effect below
		// and onChange via the ref above. Rebuilding per prop change would
		// wipe focus and flicker on every keystroke.
	}, [app]);

	useEffect(() => {
		componentRef.current?.setValue(value);
	}, [value]);

	return <span ref={containerRef} className="setting-secret-host" {...testIdAttr(testId)} />;
});
