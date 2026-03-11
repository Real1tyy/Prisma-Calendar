# Programmatic AI API

:::info Pro Feature
The Programmatic AI API requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

The AI Chat's three modes — Query, Manipulate, and Plan — are available as a programmatic API on `window.PrismaCalendar`. This lets you send natural-language messages and receive structured JSON responses from scripts, Templater, QuickAdd, or external plugins — without opening the AI Chat sidebar.

## `aiQuery(input)`

Sends a message to the AI with full calendar context and returns a structured result.

**Input:**

| Property         | Type     | Required | Default   | Description                                                                                    |
| ---------------- | -------- | -------- | --------- | ---------------------------------------------------------------------------------------------- |
| `message`        | string   | yes      | —         | Natural-language prompt (e.g., "How many hours of work this week?")                            |
| `mode`           | string   | no       | `"query"` | AI mode: `"query"`, `"manipulation"`, or `"planning"`                                          |
| `execute`        | boolean  | no       | `false`   | If `true`, automatically execute the AI-suggested operations (manipulation/planning modes only) |
| `customPromptIds`| string[] | no       | —         | IDs of custom prompts (from Settings > AI) to include as extra context                         |
| `calendarId`     | string   | no       | —         | Target calendar ID. Uses last opened calendar if omitted.                                      |

**Returns:** `Promise<PrismaAIQueryResult>`

| Property           | Type                 | Description                                                                         |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------- |
| `success`          | boolean              | Whether the AI call succeeded                                                       |
| `error`            | string?              | Error message if `success` is `false`                                               |
| `response`         | string?              | Raw AI response text (markdown for query mode, JSON for operation modes)             |
| `mode`             | string?              | The mode that was used                                                              |
| `operations`       | object[]?            | Parsed operations (manipulation/planning modes only) — see operation shapes below   |
| `validationErrors` | string[]?            | Semantic validation errors that remain after retries (if any)                        |
| `executionResult`  | object?              | Execution summary (only when `execute: true`) — `{ succeeded, failed, total }`      |

### Operation shapes

Operations in the `operations` array follow the same schema as the AI Chat:

**Create:**
```json
{ "type": "create", "title": "Meeting", "start": "2026-03-11T09:00:00", "end": "2026-03-11T10:00:00", "categories": ["Work"] }
```

**Edit:**
```json
{ "type": "edit", "filePath": "Calendar/260311090000 Meeting.md", "start": "2026-03-11T10:00:00" }
```

**Delete:**
```json
{ "type": "delete", "filePath": "Calendar/260311090000 Meeting.md" }
```

## Query Mode

Ask data-driven questions about your calendar. The AI receives your current view's events and statistics, and responds with text.

```javascript
const result = await window.PrismaCalendar.aiQuery({
  message: "How many hours did I spend on Work this week?"
});

if (result.success) {
  console.log(result.response);
}
```

## Manipulation Mode

Describe calendar changes in natural language. The AI responds with structured create/edit/delete operations.

```javascript
// Preview operations without executing
const result = await window.PrismaCalendar.aiQuery({
  message: "Create a 1-hour team meeting tomorrow at 10am",
  mode: "manipulation"
});

if (result.success && result.operations) {
  console.log(`AI suggested ${result.operations.length} operations`);
  console.log(JSON.stringify(result.operations, null, 2));
}
```

```javascript
// Execute operations immediately
const result = await window.PrismaCalendar.aiQuery({
  message: "Delete the event at 2pm on Wednesday",
  mode: "manipulation",
  execute: true
});

if (result.executionResult) {
  console.log(`${result.executionResult.succeeded}/${result.executionResult.total} operations succeeded`);
}
```

## Planning Mode

Describe how you want to allocate your time. The AI analyzes your previous interval's patterns and fills your calendar.

```javascript
const result = await window.PrismaCalendar.aiQuery({
  message: "Plan this week: 30 hours coding, 4 gym sessions, 1 hour reading each evening",
  mode: "planning",
  execute: true
});

if (result.success) {
  console.log(`Created ${result.executionResult?.succeeded} events`);
  if (result.validationErrors?.length) {
    console.warn("Validation warnings:", result.validationErrors);
  }
}
```

## Context Requirements

The API requires an **open calendar view** to gather context (events, date range, statistics). If no view is open, the call returns `{ success: false, error: "No calendar view is currently open" }`.

The context is gathered from the currently displayed date range of the calendar view — the same data the AI Chat sidebar uses.

## Validation & Retries

Manipulation and planning modes run the same validation pipeline as the AI Chat:

1. **Schema validation** — operations must have valid structure and ISO datetime formats
2. **Semantic validation** — overlap detection, gap detection (planning), day coverage (planning), boundary checks
3. **Auto-retries** — if validation fails, the AI is automatically reprompted with error details (up to 2 retries)

If validation errors remain after retries, the operations are still returned in the result with a `validationErrors` array so you can inspect them.

## URL Protocol

The AI API is also accessible via URL:

```
obsidian://prisma-calendar?call=aiQuery&message=How%20many%20hours%20of%20work%20this%20week%3F
```

```
obsidian://prisma-calendar?call=aiQuery&message=Create%20a%20meeting%20tomorrow%20at%2010am&mode=manipulation&execute=true
```

Note: `customPromptIds` is not available via URL since arrays don't serialize well to query params. Use the window API for that parameter.

## See Also

- [AI Chat](./ai-chat.md) — The interactive AI chat sidebar
- [Programmatic API](./programmatic-api.md) — The full scripting API for calendar operations
