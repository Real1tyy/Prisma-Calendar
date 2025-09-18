/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
	docs: [
		"intro",
		"installation",
		"quickstart",
		{
			type: "category",
			label: "Features",
			collapsible: true,
			items: [
				"features/overview",
				"features/multiple-calendars",
				"features/folder-scanning",
				"features/templater",
				"features/color-rules",
				"features/event-previews",
				"features/batch-operations",
				"features/recurring-dsl",
				"features/virtual-events",
				"features/hotkeys"
			]
		},
		"configuration",
		"faq",
		"troubleshooting",
		"roadmap",
		"changelog"
	]
};

module.exports = sidebars;
