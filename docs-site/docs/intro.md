---
slug: /
title: Prisma Calendar
---

<div align="center">

<div className="video-container" style={{"textAlign": "center", "marginBottom": "1em"}}>
  <iframe
    style={{"width":"100%", "aspectRatio": "16/9"}}
    src="https://www.youtube.com/embed/JjZmNJkQlnc"
    title="YouTube video player"
    frameBorder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen>
  </iframe>
  <p><em>Play the demo to see Prisma Calendar in action!</em></p>
</div>

# Prisma Calendar

**A feature-rich, fully configurable calendar plugin for Obsidian.**

</div>

Built for power users and newcomers alike, it gives you multiple isolated calendars, fine-grained filtering and color rules, fast folder-based indexing, and simple but powerful recurring events — all backed by plain Markdown notes.

## What makes Prisma Calendar different?

Prisma Calendar is built on a foundation of extreme flexibility and power, designed to adapt to your unique workflow, not the other way around.

-   **Total Configurability**: Almost every aspect of the calendar is customizable. Don't like our frontmatter keys? Change them. Want a different view, custom colors, or specific time slots? It's all in the settings. You control:
    -   **Frontmatter**: Define your own property names for start/end dates, titles, all-day events, and more.
    -   **Calendar View**: Tweak everything from the default view, first day of the week, and displayed hours to UI density and zoom levels.
    -   **Event Display**: Show custom frontmatter properties directly inside calendar events.

-   **Powerful Rule-Based Engine**: Use a simple but powerful expression language (`fm.*`) to control your calendar's appearance and content dynamically:
    -   **Coloring**: Assign colors to events based on frontmatter. For example, make all events with `fm.Priority === 'High'` red.
    -   **Filtering**: Create sophisticated views by filtering events based on frontmatter. For instance, hide all events where `fm.Status === 'Done'`.

-   **Power-User Features**:
    -   **Multiple Calendars**: Create isolated calendars, each with its own folder, settings, filters, and colors.
    -   **Recurring Events DSL**: A simple yet powerful system for creating recurring events (`weekly`, `monthly`, etc.) that generate real, editable Markdown notes.
    -   **Batch Operations**: Quickly duplicate, delete, or move multiple events at once.
    -   **Event Previews**: Hover over any event to see a preview of the note's content.

-   **Reactive & Modern**: All settings changes are applied instantly, with no need to reload Obsidian. The UI is fast, fluid, and built for a modern user experience.

-   **Lightweight & Performant**:
    -   Events are plain Markdown notes. You own your data.
    -   Uses virtual events for far-future recurrences to keep your vault clean and fast.

## Highlights

- Multiple isolated calendars (each with its own folder, filters, colors, hotkey)
- Folder-based event scanning (subfolders supported)
- Templater integration for creating event notes from your template
- Color rules with sensible default and rule-based overrides
- Event previews on hover; open on click
- Batch operations: delete, duplicate, move/clone to next week
- Recurring events DSL that generates real notes (node-based recurrence)
- Virtual events (read-only) beyond the generation horizon
- Reactive settings: changes reflect instantly

### What does an event look like?

Events are plain Markdown notes with frontmatter. You pick which frontmatter keys the calendar should read (e.g., `Start`, `End`, `AllDay`, `Title`).

```yaml
---
Title: Weekly Team Meeting
Start: 2025-01-15T09:00
End: 2025-01-15T10:30
AllDay: false
RRule: weekly
RRuleSpec: monday, wednesday, friday
Status: In Progress
Project: Q1 Planning
---

Agenda...
```

See Configuration for how to map these property names to your preferences and how to display extra properties inside event chips.

## Help Shape the Future

This plugin is under active development and is personally used every day by the developer. The goal is to make it the best calendar for Obsidian, and community feedback is crucial.

Have an idea or a feature request?
1.  **Open an Issue** on our [GitHub repository](https://github.com/Real1tyy/Prisma-Calendar/issues).
2.  **Upvote Existing Ideas**: If you see a feature request you'd like, give it a 👍 reaction.

We prioritize development based on community demand, so your voice helps us build a better calendar for everyone.
