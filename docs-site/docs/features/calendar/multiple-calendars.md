# Multiple Planning Systems

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/MultipleCalendarsSupport.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Separate contexts with dedicated configurations. The free plan supports up to 3 planning systems. [Upgrade to Pro](../free-vs-pro.md) for unlimited planning systems.

## Why multiple planning systems?

- Keep Work and Personal events in separate directories
- Use different property mappings for different workflows
- Use different filter rules for different event types
- Use different color schemes for different contexts
- Bind hotkeys to jump between planning systems quickly

## Typical setup

Each planning system **must use its own separate directory** for full independence:

1. Create a Work planning system → Directory `work/`
2. Create a Personal planning system → Directory `personal/`
3. Create a Projects planning system → Directory `projects/`
4. Add different color rules (e.g., Work blue, Personal purple)
5. Assign hotkeys to switch quickly

**Important**: Each planning system needs its own directory to maintain independent filtering and property settings.

## Example Configurations

**Separate Work/Personal Events:**
```
Planning System "Work":
  Directory: work/events/
  Properties: start, end, title
  Filters: (none)
  Colors: Blue theme

Planning System "Personal":
  Directory: personal/events/
  Properties: scheduled, deadline, name
  Filters: (none)
  Colors: Purple theme
```

**Separate Project Tracking:**
```
Planning System "Active Projects":
  Directory: projects/active/
  Filters: status !== 'done'
  Colors: Priority-based colors

Planning System "Archive":
  Directory: projects/archive/
  Filters: (none)
  Colors: Muted gray theme
```

## Sharing Directories: When It Works and When It Doesn't

Multiple planning systems **can** point to the same directory, but with important limitations to understand.

### ✅ Great Use Case: Different Visual Perspectives

If you want multiple ways to **view and style the same events**, sharing a directory works perfectly:

```
Planning System "Work - Timeline":
  Directory: work/
  View: Month view, expanded hours
  Colors: Priority-based (High → Red, Medium → Yellow)
  Display: Show all properties

Planning System "Work - Daily":
  Directory: work/  (same directory!)
  View: Day view, 8am-6pm focus
  Colors: Project-based (Phoenix → Blue, Atlas → Green)
  Display: Show only title and time
```

**What you can customize per planning system:**
- ✅ Planning system name
- ✅ View settings (hour range, default view, time slots)
- ✅ Color rules (different colors for same events)
- ✅ Display properties (which frontmatter fields to show)
- ✅ UI preferences (event preview, contrast settings)

### ❌ Won't Work: Different Filters or Properties

You **cannot** use the same directory if you need:
- ❌ Different filter expressions (one planning system shows "active", another shows "all")
- ❌ Different property mappings (one uses `start`, another uses `scheduledDate`)
- ❌ Different recurring event settings

**Why this limitation exists**: Planning systems sharing a directory share the same underlying data layer to prevent conflicts and duplicate event creation. This shared layer uses the **FIRST planning system's settings** for:
- Filter expressions
- Property mappings (Start, End, Date, etc.)
- Recurring event settings

### Decision Guide

**Use the SAME directory when:**
- ✅ You want different colored views of the same events
- ✅ You need different time ranges or view types (month vs. day)
- ✅ You want to show/hide different properties on events
- ✅ All planning systems can use the same filters and property mappings

**Use SEPARATE directories when:**
- ✅ You need different filter expressions
- ✅ You need different property mappings
- ✅ You're organizing completely different types of events
