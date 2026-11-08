import { PreviewableImage } from "@real1ty/obsidian-plugins-react";
import { memo } from "react";

import { cls, PRISMA_LOGO_SRC, tid } from "../constants";

const LABEL = "Prisma Calendar logo";

interface PrismaLogoProps {
	/** Placement class supplying the size — the base class sets none. */
	className?: string | undefined;
}

export const PrismaLogo = memo(function PrismaLogo({ className }: PrismaLogoProps) {
	return (
		<PreviewableImage
			src={PRISMA_LOGO_SRC}
			label={LABEL}
			className={className ? `${cls("logo")} ${className}` : cls("logo")}
			testId={tid("logo")}
		/>
	);
});
