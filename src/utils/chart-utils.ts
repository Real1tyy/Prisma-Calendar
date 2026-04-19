import { cls } from "../constants";

export function createChartCanvas(container: HTMLElement, chartId?: string): HTMLCanvasElement {
	const canvas = container.createEl("canvas");
	if (chartId) {
		canvas.setAttribute("id", cls(chartId));
	}
	return canvas;
}
