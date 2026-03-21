# AI Chat

:::info Pro Feature
AI Chat requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

import useBaseUrl from "@docusaurus/useBaseUrl";

Prisma Calendar includes a built-in AI chat sidebar where you can ask questions about your calendar, get scheduling advice, or have a general conversation with an AI assistant.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/AiChatQuery.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/AiChatQuery.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Opening the Chat

Open the AI chat panel using the command palette:

1. Press `Ctrl/Cmd + P`
2. Type: `Prisma Calendar: Open AI chat`
3. Press Enter

The chat opens in the right sidebar, just like Obsidian's backlinks or outline panels. Run the command again to close it.

## Configuration

Before using the chat, configure your AI provider in **Settings > AI**:

### API Keys

You need an API key from at least one provider:

- **Anthropic** — for Claude models (Opus 4.6, Sonnet 4.6, Haiku 4.5)
- **OpenAI** — for GPT models (GPT-5.2, GPT-5.1, GPT-5 Mini, GPT-5 Nano)

API keys are stored securely using Obsidian's SecretStorage.

### Model Selection

Choose which model to use from the **Model** dropdown. The default is Claude Sonnet 4.6, which offers a good balance of quality and speed.

### Custom Prompts

Define reusable context snippets that are automatically included in every conversation. This is useful for teaching the AI about your specific calendar conventions — for example, what "all-day events" mean in your vault, or how you organize categories.

Each custom prompt has a **title** (for your reference) and **content** (the actual context sent to the AI).

## Calendar Context

When you have a calendar view open, the AI chat automatically includes your current events and statistics as context. This lets you ask data-driven questions like:

- "How many hours did I spend on Work this week?"
- "What's my busiest day?"
- "Which categories am I spending the most time on?"

A **context badge** above the input area shows what the AI has access to — for example, "Main Calendar · Weekly View". The context is gathered fresh each time you send a message, so if you navigate to a different date range between messages, the AI sees the updated data.

If no calendar view is open, the badge shows "No calendar open" and the AI acts as a general scheduling assistant without access to your specific events.

### Category & Event Name Context

The AI also receives your full list of **categories** and **category assignment presets** (event name → category mappings) from your calendar settings. This means:

- When you mention an event name, the AI uses your existing categories and naming conventions rather than inventing new ones.
- If you have [category assignment presets](../organization/categories.md) configured (e.g., "Coding" → Software, "Gym" → Health), the AI recognizes those event names and applies the correct categories automatically.
- Typos in category or event names are corrected to match your existing data.

To improve the AI's accuracy, configure your category assignment presets in **Settings > Categories > Custom Category Assignment**. The more mappings you define, the better the AI can match your intent when creating or editing events.

## Modes

The AI chat has three modes, selectable via the toggle above the input area:

### Query Mode (default)

Ask read-only questions about your calendar. The AI sees your events, statistics, and date range, and answers with text.

### Event Manipulation Mode

Describe calendar changes in natural language — delete events, move them to different days, or combine multiple edits in a single prompt. The AI responds with structured operations — creates, edits, and deletes — rendered as preview cards:

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/AiChatManipulate.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/AiChatManipulate.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

- **Create** cards (green) show the new event's title and time range
- **Edit** cards (blue) show the file path and changed fields
- **Delete** cards (red) show the file path of the event to remove

Below the cards, an **Execute All** button applies all operations at once, showing a success/failure summary when done.

#### Execution Settings

Two settings in **Settings > AI > Event Manipulation** control how operations are executed:

- **Batch execution** (on by default) — All AI-suggested operations execute as a single batch. One undo (`Ctrl/Cmd + Z`) reverts everything. When disabled, each operation is a separate undo entry.
- **Confirm before execution** (on by default) — Operations render as preview cards with an Execute button. When disabled, operations execute immediately after the AI responds, without a confirmation step.

**Example prompts:**

- "Create a meeting tomorrow at 10am for 1 hour"
- "Delete the event on Wednesday at 2pm"
- "Move my morning event to 8am and rename it to Gym"
- "Replace my 3pm call with a 1-hour review session"

### Planning Mode

Describe how you want to allocate your time for the current interval and the AI fills your calendar with non-overlapping events. Unlike Manipulation mode, Planning mode also provides the AI with your **previous interval's events** as context — so it can learn your patterns (work blocks, lunch timing, gym schedule) and generate a plan that matches your habits.

Existing events in the current interval take priority — the AI plans around them. The response format is the same as Manipulation mode (operation cards with Execute All), so the same batch execution and undo behavior applies.

**Example prompts:**

- "Plan this week: 30 hours coding, 4 gym sessions, 1 hour reading each evening"
- "Fill my schedule with focused work blocks and a lunch break"
- "Plan tomorrow with 3 hours of deep work in the morning and meetings after lunch"

Switching between modes updates the current conversation's mode without clearing messages.

### Validation & Auto-Correction

Both Manipulation and Planning modes validate the AI's response before showing it to you:

- **Schema validation**: Every operation is checked for correct structure — valid ISO datetime formats, required fields, and proper types.
- **Overlap detection**: Newly created events must not overlap with each other. In Planning mode, new events are also checked against existing events. In Manipulation mode, existing events are not included in the overlap check — the AI only modifies events the user explicitly mentioned.
- **Gap detection** (Planning mode): Consecutive events should be back-to-back during active hours — gaps longer than 5 minutes are flagged.
- **Day coverage** (Planning mode): Every day in the interval must have at least one event.
- **Boundary check**: All events must fall within the current interval.

If the AI's response fails validation, it is automatically reprompted with the specific errors and asked to fix them (up to 2 retries). If issues remain after retries, the operations are shown with a warning notice so you can review them before executing.

### Validation Settings

Two toggles in **Settings > AI > Planning** let you control which validation checks run in Planning mode:

- **Gap detection** (on by default) — Validates that AI-planned events are contiguous with no gaps between consecutive events. Turn this off if your planning style allows free time between activities.
- **Day coverage** (on by default) — Validates that the AI plan covers every day in the interval. Turn this off if you only want the AI to plan specific days rather than the full interval.

When a check is disabled, it is also removed from the AI's prompt instructions, so the model won't try to satisfy a rule you've turned off.

### Pattern Detection (Planning Mode)

In Planning mode, the AI analyzes your previous interval's events to detect scheduling patterns:

- **Active hours**: When your day typically starts and ends
- **Recurring blocks**: Activities that appear 3+ days at similar times (e.g., lunch at 12:00, gym at 18:00)
- **Daily template**: A representative schedule from your busiest day

These patterns are injected into the AI's prompt so it generates plans that match your existing habits rather than starting from scratch.

## Conversation History

Conversations are saved automatically as you chat. Your conversation history persists across panel closes and Obsidian restarts.

### Thread List

Click the **Conversations** header above the message area to expand the thread list. From here you can:

- **Browse** all past conversations, sorted by most recent
- **Search** by title using the search input
- **Switch** between conversations by clicking on one
- **Delete** a conversation by clicking the × button
- **Start a new conversation** by clicking the + button or the Clear button

Each conversation remembers its mode (Query, Manipulate, or Plan), so switching to a previous thread restores the mode it was in.

### Auto-Generated Titles

When you send the first message in a new conversation, the AI generates a short summary title to label the thread. This makes it easy to identify and find past conversations in the thread list.

## Using the Chat

Type your message in the text area at the bottom and press **Enter** (or click **Send**). The AI will respond in the message area above.

- Press **Shift+Enter** to add a new line without sending
- Click **Clear** to start a new conversation (the previous one is saved in the thread list)
