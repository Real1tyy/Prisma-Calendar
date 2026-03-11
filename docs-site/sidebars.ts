import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
	tutorialSidebar: [
		{
			type: "doc",
			id: "intro",
			label: "Prisma Calendar",
		},
		"installation",
		"quickstart",
		"videos",
		"gallery",
		{
			type: "category",
			label: "Features",
			collapsible: true,
			items: [
				"features/free-vs-pro",
				"features/overview",
				{
					type: "category",
					label: "Events",
					collapsible: true,
					items: [
						"features/events/title-autocomplete",
						"features/events/event-presets",
						"features/events/event-previews",
						"features/events/event-icons",
						"features/events/event-skipping",
						"features/events/event-groups",
						"features/events/virtual-events",
						"features/events/recurring-dsl",
						"features/events/untracked-events",
					],
				},
				{
					type: "category",
					label: "Calendar",
					collapsible: true,
					items: [
						"features/calendar/calendar-view",
						"features/calendar/multiple-calendars",
						"features/calendar/folder-scanning",
						"features/calendar/holidays",
					],
				},
				{
					type: "category",
					label: "Organization",
					collapsible: true,
					items: [
						"features/organization/categories",
						"features/organization/color-rules",
						"features/organization/filtering",
						"features/organization/statistics",
					],
				},
				{
					type: "category",
					label: "Management",
					collapsible: true,
					items: [
						"features/management/global-events-management",
						"features/management/batch-operations",
						"features/management/undo-redo",
						"features/management/time-tracker",
						"features/management/notifications",
						"features/management/zettelid-naming",
					],
				},
				{
					type: "category",
					label: "Advanced",
					collapsible: true,
					items: [
						"features/advanced/templater",
						"features/advanced/integrations",
						"features/advanced/hotkeys",
						"features/advanced/programmatic-api",
						"features/advanced/programmatic-ai-api",
						"features/advanced/ai-chat",
					],
				},
			],
		},
		{
			type: "category",
			label: "Configuration",
			collapsible: true,
			items: [
				"configuration/index",
				"configuration/general",
				"configuration/properties",
				"configuration/calendar-ui",
				"configuration/toolbar-and-menus",
				"configuration/notifications",
				"configuration/rules",
				"configuration/bases",
				"configuration/event-groups",
				"configuration/integrations",
			],
		},
		"faq",
		"troubleshooting",
		"contributing",
		"support",
		"changelog",
	],
};

export default sidebars;
