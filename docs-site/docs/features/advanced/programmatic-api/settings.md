# Settings

:::info Pro Feature
The Programmatic API requires [Prisma Calendar Pro](../../free-vs-pro.md).
:::

These methods are window-API-only (not available via URL protocol).

## `getSettings(input?)`

Returns the full settings object for a calendar.

**Input:**

| Property     | Type   | Required | Description        |
| ------------ | ------ | -------- | ------------------ |
| `calendarId` | string | no       | Target calendar ID |

**Returns:** `SingleCalendarConfig | null` — the complete settings object.

**Example:**

```javascript
const settings = window.PrismaCalendar.getSettings();
console.log(`Default duration: ${settings.defaultDurationMinutes}m`);
console.log(`Category property: ${settings.categoryProp}`);
```

## `updateSettings(input)`

Updates calendar settings by shallow-merging the provided values into the current settings. The `id` field is stripped to prevent calendar ID corruption.

**Input:**

| Property     | Type   | Required | Description                              |
| ------------ | ------ | -------- | ---------------------------------------- |
| `settings`   | object | yes      | Partial settings object to merge         |
| `calendarId` | string | no       | Target calendar ID                       |

**Returns:** `Promise<boolean>` — `true` if the update succeeded, `false` otherwise.

**Example:**

```javascript
// Change default event duration
await window.PrismaCalendar.updateSettings({
  settings: { defaultDurationMinutes: 30 }
});

// Toggle decimal hours display
const current = window.PrismaCalendar.getSettings();
await window.PrismaCalendar.updateSettings({
  settings: { showDecimalHours: !current.showDecimalHours }
});
```
