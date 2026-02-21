# AI Chat

Prisma Calendar includes a built-in AI chat sidebar where you can ask questions about your calendar, get scheduling advice, or have a general conversation with an AI assistant.

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

## Using the Chat

Type your message in the text area at the bottom and press **Enter** (or click **Send**). The AI will respond in the message area above.

- Press **Shift+Enter** to add a new line without sending
- Click **Clear** to reset the conversation
- Conversations are ephemeral — they reset when you close the panel

## Tips

- Ask about your schedule: "How many events do I have this week?"
- Analyze time usage: "What categories am I spending the most time on?"
- Ask about scheduling patterns: "What's a good way to organize weekly meetings?"
- Get advice on calendar setup: "How should I configure recurring events?"
- The AI remembers the full conversation within a session, so you can ask follow-up questions
