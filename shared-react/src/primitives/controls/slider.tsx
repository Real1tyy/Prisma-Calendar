import { SliderComponent } from "obsidian";
import { memo, useEffect, useRef } from "react";

import { useDebouncedCommit } from "../../hooks/interaction/use-debounced-commit";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { testIdAttr } from "../../utils/test-id";

interface SliderProps {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string | undefined;
}

export const Slider = memo(function Slider({ value, min, max, step, onChange, debounceMs, testId }: SliderProps) {
	useInjectedStyles("setting-slider-host-styles", ".setting-slider-host { display: contents; }");
	const hostRef = useRef<HTMLSpanElement>(null);
	const componentRef = useRef<SliderComponent | null>(null);
	const { draft, setDraft, flush } = useDebouncedCommit<number>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	const setDraftRef = useRef(setDraft);
	setDraftRef.current = setDraft;
	const flushRef = useRef(flush);
	flushRef.current = flush;
	const initialDraftRef = useRef(draft);

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const component = new SliderComponent(el)
			.setLimits(min, max, step ?? 1)
			.setValue(initialDraftRef.current)
			.setDynamicTooltip()
			.onChange((next) => setDraftRef.current(next));
		componentRef.current = component;
		const flushOnRelease = () => flushRef.current();
		const sliderEl = el.querySelector("input[type='range']");
		sliderEl?.addEventListener("change", flushOnRelease);
		sliderEl?.addEventListener("pointerup", flushOnRelease);
		sliderEl?.addEventListener("blur", flushOnRelease);
		return () => {
			sliderEl?.removeEventListener("change", flushOnRelease);
			sliderEl?.removeEventListener("pointerup", flushOnRelease);
			sliderEl?.removeEventListener("blur", flushOnRelease);
			el.replaceChildren();
			componentRef.current = null;
		};
		// Rebuild when bounds change; draft updates are forwarded via the
		// setValue effect below. Rebuilding on every draft change would fight
		// the user mid-drag.
	}, [min, max, step]);

	useEffect(() => {
		componentRef.current?.setValue(draft);
	}, [draft]);

	return <span ref={hostRef} className="setting-slider-host" {...testIdAttr(testId)} />;
});
