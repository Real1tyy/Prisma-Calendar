import { SecretComponent } from "obsidian";
import { memo, useEffect, useRef } from "react";

import { useApp } from "../contexts/app-context";

interface SecretFieldProps {
	/**
	 * The secret ID (not the secret value). Actual credentials live in the OS
	 * keychain via `app.secretStorage.setSecret(id, credential)`; the plugin's
	 * settings file only stores the ID so nothing sensitive hits `data.json`.
	 */
	value: string;
	onChange: (id: string) => void;
}

/**
 * React wrapper around Obsidian's imperative `SecretComponent`. Requires an
 * `<AppContext>` ancestor (already provided by `renderReactInline` /
 * `ReactModal` / `registerReactView`).
 */
export const SecretField = memo(function SecretField({ value, onChange }: SecretFieldProps) {
	const app = useApp();
	const containerRef = useRef<HTMLSpanElement>(null);
	const componentRef = useRef<SecretComponent | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const component = new SecretComponent(app, el).setValue(value).onChange((next) => onChangeRef.current(next));
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

	return <span ref={containerRef} className="setting-secret-host" />;
});
