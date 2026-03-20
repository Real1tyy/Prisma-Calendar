# FAQ

## 📱 Getting Started

<details>
<summary>Does it work on mobile?</summary>

Core features work on mobile without any problems. The design is responsive, and I'm continuously tightening up the mobile experience based on feedback to make it rock solid. If you run into anything, please open a [GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues).

</details>

<details>
<summary>Is it free?</summary>

Yes! Prisma Calendar is free and fully-featured out of the box — no account, no trial, no limitations on the core experience. You get 4 calendar views, up to 3 calendars, recurring events with 9 recurrence types, 50-action undo/redo, 10+ batch operations, a time tracker, statistics dashboard, color rules, advanced filtering, desktop notifications, holidays for 50+ countries, title autocomplete, and 30+ hotkeys — all for free.

Pro unlocks additional power-user features: AI chat, CalDAV & ICS sync, programmatic API, unlimited calendars/presets, and priority support.

See [Free vs Pro](./features/free-vs-pro.md) for the full breakdown, or visit the [product page](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_source=docs-site&utm_medium=content&utm_content=faq-product-page) to start a 30-day free trial.

</details>

<details>
<summary>How do I open the calendar view?</summary>

See the [Quick Start guide](/quickstart) for detailed instructions on opening your calendar, including ribbon icons, command palette, hotkeys, and more.

</details>

---

## 🔒 Privacy & Telemetry

<details>
<summary>Does Prisma Calendar collect any data from my vault?</summary>

**No.** Prisma Calendar does not include any client-side telemetry or analytics. No vault content, file names, note content, or personal data from your Obsidian vault is ever transmitted. Your data is 100% yours and stays local.

</details>

<details>
<summary>What about server-side telemetry?</summary>

Server-side telemetry is collected **exclusively** during license verification requests for Pro (advanced) features. When the plugin contacts the license server, only the following data is transmitted:

- License key
- Plugin version
- Obsidian version
- Operating system / platform
- Device identifier (a locally generated unique ID)
- Device name

This data is used solely for license validation, activation seat management (up to 5 devices per license), compatibility monitoring, abuse prevention, and product improvement. **If you only use the free features, no telemetry data is collected at all.**

</details>

<details>
<summary>Where can I read the full legal terms?</summary>

- [Privacy Policy](https://matejvavroproductivity.com/privacy/)
- [Terms of Service](https://matejvavroproductivity.com/terms/)
- [Legal Notice / Imprint](https://matejvavroproductivity.com/legal/)

</details>

<details>
<summary>Is Prisma Calendar affiliated with Obsidian?</summary>

No. Prisma Calendar is developed by [Matej Vavro](https://matejvavroproductivity.com/) and is an independent, third-party product. It is not affiliated with, endorsed by, or sponsored by Obsidian (Dynalist Inc.). All references to "Obsidian" are for descriptive and compatibility purposes only.

</details>

---

## 📚 About This Documentation

<details>
<summary>Is the documentation completely up to date and accurate?</summary>

I strive for perfection, but Prisma Calendar is a **large, feature-rich project** with extensive documentation. It's quite complex for one person to manage everything perfectly, so there may be occasional inaccuracies or outdated information.

**If you spot something wrong, please help!**
- Create a [Pull Request](https://github.com/Real1tyy/Prisma-Calendar/pulls) to fix it
- [Open an issue](https://github.com/Real1tyy/Prisma-Calendar/issues) to report it
- Suggest improvements or clarifications

Community contributions help continuously improve the documentation and keep it accurate. Every correction, no matter how small, makes the docs better for everyone.

</details>

---

## 🔧 General Questions

<details>
<summary>Can I use multiple calendars at once?</summary>

Yes. Calendars can use separate directories for full isolation, or share the same directory for different visual perspectives of the same events. See [Multiple Calendars](./features/calendar/multiple-calendars.md) for details.

</details>

<details>
<summary>What happens if multiple calendars use the same directory?</summary>

Multiple calendars **can** share the same directory — great for creating different views and color schemes of the same events. Some settings (like view, color rules, display properties) are per-calendar, while others (like property mappings and filters) are shared across calendars on the same directory.

See [Multiple Calendars](./features/calendar/multiple-calendars.md) for full details. If you run into issues with shared directories, check the [Troubleshooting — Multiple Calendars](./troubleshooting.md#-multiple-calendars) section.

</details>

<details>
<summary>Are recurring events real notes?</summary>

Yes. Prisma Calendar generates real notes up to your configured "Future instances count." Farther-out instances show as read-only virtual events to keep your vault lean. See [Recurring Events](./features/events/recurring-dsl.md) for details.

</details>

<details>
<summary>Why do my event files have timestamps in their names, but the calendar shows clean titles?</summary>

Prisma Calendar uses **ZettelID naming** — each event file gets a unique timestamp suffix (e.g., `Team Meeting-20250106143022.md`), but the calendar always displays just the clean title (`Team Meeting`). This lets you create multiple events with the same name without conflicts, while keeping the UI clean.

See [ZettelID Naming](./features/management/zettelid-naming) for full details.

</details>

<details>
<summary>How do I change which frontmatter keys the calendar uses?</summary>

Go to Properties Settings and set your Start/End/AllDay/Title keys.

</details>

<details>
<summary>Why did my weekly recurring event start on a different day than its Start date?</summary>

The `Start` date is a **calculation starting point**, not always the first event's date. For weekly/bi-weekly rules, the system finds the first day **on or after** the `Start` date that matches your `RRuleSpec` (e.g., the first "sunday"). If your start date is a Friday but the rule is for every Sunday, the first event will be created on the following Sunday.

</details>

<details>
<summary>How do color rules work?</summary>

Color rules are evaluated top-to-bottom. The first expression that evaluates to true sets the color. Example: `Priority === 'High' → red`. See [Color Rules](./features/organization/color-rules) for details.

</details>

<details>
<summary>Can I preview notes on hover?</summary>

Yes. Enable "Enable event preview" in Calendar Settings (UI). Event tooltips also show the first three lines of the note's body content, loaded on first hover. See [Event Previews](./features/events/event-previews) for details.

</details>

---

## 🔗 Integrations

<details>
<summary>Is external calendar integration supported?</summary>

Yes! Prisma Calendar supports integration with external calendars through two methods:

1. **CalDAV Sync (Read-Only)** — Automatically sync events from CalDAV servers (Fastmail, Nextcloud, iCloud, and other CalDAV-compatible services) into Obsidian. Events are imported as markdown notes with full frontmatter support.

2. **ICS Import/Export** — Manually exchange calendar files with any calendar application (Apple Calendar, Outlook, Thunderbird, etc.) using the standard ICS/iCalendar format.

**Current Status:**
- ✅ **CalDAV**: Read-only sync (server → Obsidian)
- ✅ **ICS**: Full import/export support
- 🔄 **Planned Improvements**: Two-way sync, write support for CalDAV, and enhanced sync capabilities

For detailed setup instructions and configuration, see the [Integrations documentation](/features/advanced/integrations).

</details>

<details>
<summary>Is Google Calendar integration supported?</summary>

Google Calendar integration is planned for the future. Currently, you can use **ICS import/export** to exchange events with Google Calendar. Export your Prisma Calendar events as ICS files and import them into Google Calendar, or import Google Calendar exports into Prisma Calendar. See the [Integrations documentation](/features/advanced/integrations) for detailed instructions.

</details>

<details>
<summary>Can I use Prisma Calendar with Templater?</summary>

Yes. Configure your template path in both Templater (folder template) AND Prisma Calendar settings (General → Template path) to ensure templates apply consistently whether you create events through the calendar or manually. See [Troubleshooting - Templater Integration](troubleshooting.md#templater-integration).

</details>

<details>
<summary>Does this plugin use any calendar library?</summary>

Yes! Prisma Calendar is built using [FullCalendar](https://fullcalendar.io/), a powerful and flexible JavaScript calendar library. FullCalendar provides the robust calendar rendering engine that powers Prisma Calendar's views and interactions.

</details>

---

## 🛠️ Troubleshooting

<details>
<summary>Something isn't working as expected — what should I do?</summary>

Check the [Troubleshooting guide](./troubleshooting.md) for common issues and solutions — including performance tips, event display problems, multi-calendar conflicts, Bases integration, and Templater setup. If your problem isn't covered there, please [open a GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose) with steps to reproduce.

</details>

---

## 💙 Support

<details>
<summary>How can I support the project?</summary>

The best way to support Prisma Calendar is by purchasing an [Advanced Features](./features/free-vs-pro.md) license — you get powerful capabilities while directly funding development. You can also subscribe to the [YouTube channel](https://www.youtube.com/@real1tyy), share the plugin with others, or [donate](https://matejvavroproductivity.com/support/?utm_source=docs-site&utm_medium=content&utm_content=faq-donate). See the [Support page](./support.md) for all options.

</details>
