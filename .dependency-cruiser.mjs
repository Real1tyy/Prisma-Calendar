/** @type {import('dependency-cruiser').IConfiguration} */
export default {
	forbidden: [
		{
			name: "core-cannot-import-components",
			comment: "Core business logic must not depend on UI components",
			severity: "error",
			from: {
				path: "^src/core/",
				pathNot: [
					"^src/core/api/modal-actions\\.ts$",
					"^src/core/minimized-modal-manager\\.ts$",
					"^src/core/notification-manager\\.ts$",
				],
			},
			to: { path: "^src/components/" },
		},
		{
			name: "utils-cannot-import-core",
			comment: "Utilities must not depend on core business logic",
			severity: "error",
			from: { path: "^src/utils/" },
			to: { path: "^src/core/" },
		},
		{
			name: "utils-cannot-import-components",
			comment: "Utilities must not depend on UI components",
			severity: "error",
			from: { path: "^src/utils/" },
			to: { path: "^src/components/" },
		},
		{
			name: "types-cannot-import-core",
			comment: "Types must not depend on core business logic",
			severity: "error",
			from: { path: "^src/types/" },
			to: { path: "^src/core/" },
		},
		{
			name: "types-cannot-import-components",
			comment: "Types must not depend on UI components",
			severity: "error",
			from: { path: "^src/types/" },
			to: { path: "^src/components/" },
		},
		{
			name: "types-cannot-import-utils",
			comment: "Types should be self-contained (except shared lib and validation schemas)",
			severity: "warn",
			from: { path: "^src/types/" },
			to: { path: "^src/utils/", pathNot: "^src/utils/validation\\.ts$" },
		},
	],
	options: {
		doNotFollow: {
			path: ["node_modules", "docs-site"],
		},
		tsPreCompilationDeps: true,
		tsConfig: {
			fileName: "./tsconfig.json",
		},
		includeOnly: "^src/",
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default"],
			mainFields: ["module", "main", "types", "typings"],
		},
		reporterOptions: {
			text: {
				highlightFocused: true,
			},
		},
	},
};
