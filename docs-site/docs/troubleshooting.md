# Troubleshooting

Use this checklist to diagnose common issues. If your problem isn't listed here, please [open a GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose).

## 🩺 Start with the Doctor

When something feels off, open the **Doctor** first — it answers "is it me or the plugin?" in a few seconds. Open the command palette (`Ctrl/Cmd+P`) and run **Prisma Calendar: Open Doctor**, or press **Open Doctor** under **Settings → General → Doctor**.

Each row is one health check with a plain-language explanation:

| Check | What it tells you |
| --- | --- |
| **Indexing** | How many notes Prisma read and how many of them reached the calendar. It flags notes it could not read — usually a date property that isn't a recognised date, or one that isn't mapped — and offers a **Reindex** button. |
| **Settings** | Whether your settings loaded and migrated cleanly. |
| **License** | Your current license state, in the same words the License section uses. |
| **Recent errors and warnings** | Anything that went wrong in the last 15 minutes, grouped by the part of the plugin that reported it. |

A green row means that check found nothing wrong. A yellow row is worth reading; a red row is something Prisma could not do.

### Copy debug

The **Copy debug** button at the top gathers everything useful about the problem into one block of text and puts it on your clipboard, ready to paste into a GitHub issue. **Save debug to file** writes the same text into your export folder instead, so you can attach it.

The bundle contains your Prisma and Obsidian versions and platform, the health checks above, every warning and error recorded this session, and all activity from the last 15 minutes.

Folder and note names are abbreviated, property values are replaced by their type, and secrets are never included. Nothing is sent anywhere — copying and saving are the only things these buttons do. **Include full detail** keeps real paths and property values for someone you trust; secrets stay out either way. See [Privacy & diagnostics](./privacy) for a complete before-and-after example.

---

## ⚡ Performance

<details>
<summary>Calendar feels slow in a large vault</summary>

Prisma Calendar is designed to handle large vaults without issues. If you're experiencing lag, try the tips below. For very large vaults, if you experience severe issues, please also [open a GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose) — I want Prisma to work smoothly for vaults of any size.

- Disable **Enable name series tracking** (Settings → Configuration → Performance) to stop tracking events by title
- Disable **Show color dots** (Settings → Calendar) to skip per-day event scanning in monthly view
- Disable **Highlight upcoming event** (Settings → Calendar) to remove the 1-minute interval timer
- Disable **Enable event preview** (Settings → Calendar) to skip loading note content on hover
- Disable **Enable notifications** (Settings → Notifications) to remove the 1-minute interval check
- Disable **Enable holidays** (Settings → Integrations) to skip external library loading

</details>

---

## 📅 Events

<details>
<summary>Events not appearing</summary>

- Plugin enabled and vault reloaded
- Calendar Directory points to the correct folder (subfolders included)
- Note has a valid `Start` property (ISO format recommended, e.g., `2025-02-10T14:00`)
- Filters aren't excluding your note (Rules → Event Filtering)
- Frontmatter keys match your Properties Settings (e.g., `Start` vs `start`)
- **Try refreshing**: Open command palette (Ctrl/Cmd+P) and run "Refresh calendar" to force a full resync

</details>

<details>
<summary>Wrong colors or no color applied</summary>

- The first matching color rule wins — check rule order
- Expressions use property names directly (e.g., `Priority === 'High'`)
- Color value is valid CSS (hex/name/HSL)

</details>

<details>
<summary>Recurring events missing</summary>

- `RRule` is set (e.g., `weekly`) and valid `RRuleSpec` for week-based schedules
- "Future instances count" is high enough to cover the date you expect
- Virtual events show beyond the generation horizon (read-only)

</details>

<details>
<summary>Events appearing as all-day when they should be timed (or vice versa)</summary>

**Problem**: You duplicate a timed event, but the duplicate appears as an all-day event. Or you have events that show start/end times in frontmatter but display as all-day on the calendar.

**Root Cause**: The `All Day` property is the **source of truth** for determining event type. Prisma ignores `Start`/`End` properties when `All Day: true` is set, and ignores the `Date` property when `All Day: false` (or unset).

</details>

---

## 📆 Multiple Planning Systems

<details>
<summary>Events not showing after creating a new planning system</summary>

**Problem**: After creating a new planning system, the calendar view shows no events or the wrong events.

**Solution**: Make sure you configured both the directory and the property mappings. Open Settings, select the new planning system, and use **Configure current** to set the directory and properties. Each planning system is fully independent — it only sees events matching its own configured property names.

</details>

<details>
<summary>Two planning systems on the same directory showing overlapping events</summary>

**Problem**: Two planning systems point at the same directory and both show the same events even though you want each to show different ones.

**Solution**: Configure different property mappings for each planning system. For example, one system uses `meetingStart` / `meetingEnd` while the other uses `dueDate` / `deadline`. Each planning system only sees notes whose frontmatter contains its configured start property. If both systems use the same property names, they will both see all matching events — that's the expected behavior.

</details>

---

## 📊 Bases Integration

<details>
<summary>"Show current interval in Bases" shows no events</summary>

This command requires **Sorting normalization** to be enabled. See [Bases — Sort date property required for interval views](./configuration/bases.md#where-bases-views-are-used) for the fix.

</details>

<details>
<summary>Events not sorting correctly by Sort Date in Bases</summary>

If events appear out of order when sorting by `Sort Date` in Bases views, the property type is likely set to "Text" instead of "Date & time". Obsidian's Bases sorts text properties alphabetically, which produces incorrect results for datetime values.

**To fix this:**

1. Open **Obsidian Settings → Properties**
2. Find the `Sort Date` property (or whatever name you configured in Prisma Calendar's "Sort date property" setting)
3. Change its type to **Date & time**

Alternatively, you can edit `.obsidian/types.json` directly and add the property with the `datetime` type:

```json
{
  "types": {
    "Sort Date": "datetime"
  }
}
```

After changing the property type, Bases will sort events chronologically. See the [Configuration — Sorting Normalization](./configuration/properties#sorting-normalization-for-external-tools) documentation for full details on how sort date normalization works.

</details>

---

## 🔌 Templater Integration

<details>
<summary>Templater not working</summary>

- Templater plugin is installed and enabled
- Template path in General Settings is correct
- Your template renders outside Prisma Calendar (sanity check)

</details>

<details>
<summary>Templates not applying to Prisma-created events</summary>

**Problem**: Templater folder templates work for manually created notes, but not for events created through Prisma Calendar.

**Root Cause**: Prisma creates files programmatically, which can bypass Templater's folder trigger or cause race conditions.

**Solution**: Configure templates in BOTH places:

1. **Templater Settings**: Set up your folder template as usual
2. **Prisma Calendar Settings**: Go to `General` → `Template path` and set the same template file

This ensures the template is applied atomically when Prisma creates the event file.

</details>

<details>
<summary>Events created are saved to root folder instead of configured directory</summary>

**Problem**: When creating events, files are saved to the vault root instead of the configured directory (e.g., "Tasks" folder). This only happens when Templater is enabled and `templatePath` is set.

**Root Cause**: Older versions of Templater (pre-2.15) use an outdated API that doesn't properly handle the folder parameter when creating notes from templates programmatically.

**Solution**: Update Templater to version 2.15 or higher:

1. Go to Settings → Community Plugins
2. Find "Templater" in your installed plugins
3. Check the version number
4. If below 2.15, click "Update" or reinstall the plugin
5. Restart Obsidian

**Verified Working**: Templater version 2.15+ correctly respects the `templatePath` setting and creates files in the configured directory.

</details>

<details>
<summary>Inconsistent date properties for sorting</summary>

**Problem**: Events have different property names (`Start Date` for timed events, `Date` for all-day events) and formats (`2025-02-10T14:00:00.000Z` vs `2025-02-10T14:00:00`), making it impossible to sort chronologically in other tools like Bases or Dataview.

**Root Cause**: Prisma uses different properties based on event type, and ISO format includes `.000Z` suffix.

**Solution**: Create a "watcher" script that normalizes dates into a dedicated sort property.

**Result**: Consistent `sort_date` property across all events for reliable chronological sorting in Bases, Dataview, or other tools.

</details>

---

## Still stuck?

If none of the above fixes your issue, I'm happy to help — [open a GitHub issue](https://github.com/Real1tyy/Prisma-Calendar/issues/new/choose) with steps to reproduce, or [send me your feedback](https://matejvavroproductivity.com/feedback?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=troubleshooting&utm_content=feedback).

Any diagnostics you attach are redacted before you share them and never leave your device on their own — see [Privacy & diagnostics](./privacy) for exactly what they contain.
