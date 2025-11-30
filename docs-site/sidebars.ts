import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {
      type: "doc",
      id: "intro",
      label: "Prisma Calendar"
    },
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
        "features/filtering",
        "features/weekly-stats",
        "features/time-tracker",
        "features/global-search",
        "features/notifications",
        "features/event-previews",
        "features/zettelid-naming",
        "features/batch-operations",
        "features/event-skipping",
        "features/undo-redo",
        "features/recurring-dsl",
        "features/virtual-events",
        "features/integrations",
        "features/hotkeys"
      ]
    },
    "configuration",
    "faq",
    "troubleshooting",
    "contributing",
    "support",
    "changelog"
  ]
};

export default sidebars;
