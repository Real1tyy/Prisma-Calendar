# Troubleshooting

Use this checklist to diagnose common issues.

## Events not appearing

- Plugin enabled and vault reloaded
- Calendar Directory points to the correct folder (subfolders included)
- Note has a valid `Start` property (ISO format recommended, e.g., `2025-02-10T14:00`)
- Filters aren’t excluding your note (Rules → Event Filtering)
- Frontmatter keys match your Properties Settings (e.g., `Start` vs `start`)

## Wrong colors or no color applied

- The first matching color rule wins — check rule order
- Expressions use `fm` (e.g., `fm.Priority === 'High'`)
- Color value is valid CSS (hex/name/HSL)

## Templater not working

- Templater plugin is installed and enabled
- Template path in General Settings is correct
- Your template tokens render outside Prisma Calendar (sanity check)

## Timezone issues

- Default timezone set to `system` or a valid IANA name (e.g., `Europe/Berlin`)
- If using a per-note Timezone property, confirm the value is valid

## Recurring events missing

- `RRule` is set (e.g., `weekly`) and valid `RRuleSpec` for week-based schedules
- “Future instances count” is high enough to cover the date you expect
- Virtual events show beyond the generation horizon (read-only)
