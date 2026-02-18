# Event Presets

import useBaseUrl from "@docusaurus/useBaseUrl";

Save reusable event templates with pre-filled values for quick event creation.

{/* TODO: Add video showing preset creation and usage */}

## Creating Presets

1. Open the Create or Edit Event modal
2. Fill in the fields you want to save (title, dates, categories, location, participants, recurring settings, custom properties)
3. Click **Save as preset**
4. Enter a name for the preset (e.g., "Weekly Team Meeting")
5. Choose to create a new preset or override an existing one

{/* TODO: Add screenshot of "Save as preset" button in modal */}

## Using Presets

- **Apply**: Select a preset from the dropdown in the modal header to populate all fields instantly
- **Clear**: Click the clear button to reset all fields to an empty state
- **Default preset**: Configure a default preset in Settings → General → Event Presets that auto-applies when creating new events

{/* TODO: Add screenshot of preset dropdown in modal header */}

## What Presets Save

| Field | Saved | Notes |
|-------|-------|-------|
| Title | ✅ | Pre-fill event name |
| All-day | ✅ | Timed vs all-day mode |
| Date/Start/End | ✅ | Date and time values |
| Categories | ✅ | Category assignment |
| Location | ✅ | Event location (single string) |
| Icon | ✅ | Event icon override (emoji or text) |
| Participants | ✅ | Event participants (comma-separated) |
| Recurring settings | ✅ | RRule type, weekdays, future count |
| Custom properties | ✅ | Any additional frontmatter |

## Default Preset

Set a default preset to auto-fill fields every time you create a new event:

1. Go to **Settings → General → Event Presets**
2. Select a preset from the **Default preset** dropdown
3. New events will now open with the selected preset's values pre-filled

To stop auto-filling, set the default preset back to "None".

## Managing Presets

- **Override**: When saving a preset with the same name as an existing one, you can choose to override it with the new values
- **Per-calendar**: Presets are stored per calendar, so each calendar can have its own set of templates

## See Also

- [Configuration → Event Presets](../../configuration/general#event-presets) for the settings reference
- [Categories](../organization/categories) for managing event categories used in presets
- [Recurring Events](./recurring-dsl) for recurring settings saved in presets
