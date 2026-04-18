import useBaseUrl from "@docusaurus/useBaseUrl";

# Title Autocomplete

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/TitleAutocomplete.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/TitleAutocomplete.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

When you type an event title in the create or edit modal, Prisma Calendar suggests matching names in a dropdown below the input. This speeds up event creation and keeps naming consistent across your calendar.

## How it works

As you type, suggestions appear from three sources, in priority order:

1. **Categories** — your existing category names
2. **Event presets** — names from your configured event presets
3. **Frequently used names** — event names you've used before, sorted by how often they appear

If a name exists in multiple sources (e.g., "Work" is both a category and a frequent event name), it appears once under the highest-priority source.

## Accepting suggestions

- **Arrow keys** — navigate the dropdown list
- **Enter** — select the highlighted suggestion
- **Tab** — accept the ghost text (the faint completion shown inline)
- **Escape** — dismiss the dropdown

## Ghost text

The top suggestion's completion appears as faint text after your cursor, similar to IDE autocomplete. For example, typing "Wor" with a "Work" category shows "k" as ghost text. Press Tab to accept it.

## Auto-category assignment

When you select a suggestion (via Enter or Tab), the title field's blur event fires automatically, triggering auto-category assignment if you have category assignment presets configured. This means selecting a category name as your title can automatically assign that category.

## Settings

Configure in **Settings → General → Parsing → Title autocomplete** (enabled by default). When disabled, the dropdown and ghost text are hidden and no suggestions are shown.

## Limits

- Up to 10 suggestions are shown at a time
- Matching is case-insensitive substring (typing "meet" matches "Team Meeting")
- Only the title field is filled — selecting a preset name fills the title, not all preset fields (use the preset dropdown in the modal header for that)

## Filename-illegal characters

The title becomes part of the event's filename, so characters that aren't valid in filenames are rejected at save time. If your title contains `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, or `|`, the save is blocked and a notice tells you which character(s) to remove. The modal stays open so you don't lose other fields while fixing the title.
