import { setIcon } from "obsidian";
import { memo, useEffect, useRef } from "react";

interface ObsidianIconProps {
	icon: string;
	className?: string;
}

export const ObsidianIcon = memo(function ObsidianIcon({ icon, className }: ObsidianIconProps) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (ref.current) {
			ref.current.innerHTML = "";
			setIcon(ref.current, icon);
		}
	}, [icon]);

	return <span ref={ref} className={className} />;
});
