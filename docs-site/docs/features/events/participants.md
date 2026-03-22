# Participants

Participants let you track who is involved in an event. They appear as removable chips in the Create/Edit Event modal, similar to categories and prerequisites.

## Adding participants

Type a name or an Obsidian link (`[[Person Name]]`) into the input field and press **Enter** or click **Add**. Each participant appears as a chip that you can remove with the **x** button.

## Plain names vs. links

Participants support two formats:

- **Plain text** — a simple string like `Alice` or `Team Lead`. Displayed as-is.
- **Obsidian link** — a wiki link like `[[People/Alice]]` or `[[Alice|Alice Smith]]`. The chip displays the cleaned-up display name (e.g., "Alice" or "Alice Smith") with a tooltip showing the full link path.

You can mix both formats freely on the same event.

## Storage

Participants are stored as a YAML list in frontmatter under the configured property name (default: `Participants`). Configure the property name in **Settings > Properties > Participants property**.

```yaml
Participants:
  - Alice
  - "[[People/Bob]]"
  - Charlie
```

## Configuration

Enable participants by setting a **Participants property** name in **Settings > Properties**. When the property is empty, the participants field is hidden from the event modal.
