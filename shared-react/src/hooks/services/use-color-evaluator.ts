import { ColorEvaluator, type ColorRule } from "@real1ty-obsidian-plugins";
import { useEffect, useState } from "react";
import type { BehaviorSubject } from "rxjs";

export function useColorEvaluator<TSettings extends { defaultNodeColor: string; colorRules: ColorRule[] }>(
	settings$: BehaviorSubject<TSettings>
): ColorEvaluator<TSettings> {
	const [evaluator] = useState(() => new ColorEvaluator<TSettings>(settings$));
	useEffect(() => () => evaluator.destroy(), [evaluator]);
	return evaluator;
}
