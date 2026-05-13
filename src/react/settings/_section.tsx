import { SchemaSection } from "@real1ty-obsidian-plugins-react";
import type { ComponentProps } from "react";

export const PRISMA_SETTINGS_TEST_ID_PREFIX = "prisma-settings-";

type SchemaSectionProps = ComponentProps<typeof SchemaSection>;

export function PrismaSection(props: Omit<SchemaSectionProps, "testIdPrefix">) {
	return <SchemaSection {...props} testIdPrefix={PRISMA_SETTINGS_TEST_ID_PREFIX} />;
}
