export function enableDragToPan(scrollContainer: HTMLElement, excludeSelector: string): () => void {
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let scrollLeft = 0;
	let scrollTop = 0;

	function onMouseDown(e: MouseEvent): void {
		const target = e.target as HTMLElement;
		if (target.closest(excludeSelector)) return;
		isDragging = true;
		startX = e.clientX;
		startY = e.clientY;
		scrollLeft = scrollContainer.scrollLeft;
		scrollTop = scrollContainer.scrollTop;
		scrollContainer.style.cursor = "grabbing";
		e.preventDefault();
	}

	function onMouseMove(e: MouseEvent): void {
		if (!isDragging) return;
		scrollContainer.scrollLeft = scrollLeft - (e.clientX - startX);
		scrollContainer.scrollTop = scrollTop - (e.clientY - startY);
	}

	function onMouseUp(): void {
		if (!isDragging) return;
		isDragging = false;
		scrollContainer.style.cursor = "";
	}

	scrollContainer.addEventListener("mousedown", onMouseDown);
	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);

	return () => {
		scrollContainer.removeEventListener("mousedown", onMouseDown);
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
	};
}
