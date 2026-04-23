import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode } from "react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";

export interface VirtualListProps<T> {
	items: readonly T[];
	estimateSize: number;
	renderItem: (item: T, index: number) => ReactNode;
	getKey?: (item: T, index: number) => string | number;
	overscan?: number;
	className?: string;
	style?: CSSProperties;
}

export interface VirtualListHandle {
	scrollToIndex: (index: number, opts?: { align?: "start" | "center" | "end" | "auto" }) => void;
	containerRef: HTMLDivElement | null;
}

function VirtualListInner<T>(
	{ items, estimateSize, renderItem, getKey, overscan = 8, className, style }: VirtualListProps<T>,
	ref: React.ForwardedRef<VirtualListHandle>
) {
	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => estimateSize,
		overscan,
		...(getKey ? { getItemKey: (index: number) => getKey(items[index], index) } : {}),
		measureElement: (el) => el.getBoundingClientRect().height,
	});

	const scrollToIndex = useCallback(
		(index: number, opts?: { align?: "start" | "center" | "end" | "auto" }) => {
			virtualizer.scrollToIndex(index, opts);
		},
		[virtualizer]
	);

	useImperativeHandle(ref, () => ({ scrollToIndex, containerRef: scrollRef.current }), [scrollToIndex]);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div ref={scrollRef} className={className} style={{ overflow: "auto", contain: "strict", ...style }}>
			<div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
				{virtualItems.map((virtualRow) => (
					<div
						key={virtualRow.key}
						data-index={virtualRow.index}
						ref={virtualizer.measureElement}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							transform: `translateY(${virtualRow.start}px)`,
						}}
					>
						{renderItem(items[virtualRow.index], virtualRow.index)}
					</div>
				))}
			</div>
		</div>
	);
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
	props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> }
) => ReactNode;
