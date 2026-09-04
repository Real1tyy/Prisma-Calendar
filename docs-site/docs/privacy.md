---
title: Privacy & diagnostics
description: What stays on your device, what leaves it and when, and how diagnostics are redacted before you share them.
---

# Privacy & diagnostics

Prisma Calendar is local-first. Your notes, file names, and settings stay in your vault. There is no client-side telemetry or analytics, and nothing is uploaded in the background.

## What leaves your device, and when

Only two things ever contact a server on their own, and both are documented where you configure them:

- **License verification** for Pro features — see [License & activation](./configuration/license) and the [privacy FAQ](./faq#-privacy--telemetry) for the exact fields sent.
- **The update check** — a single anonymous request to GitHub Releases, described under [General settings](./configuration/general).

Everything else — a log excerpt, a debug report, a bug report — leaves your device **only when you copy or send it yourself**. Nothing is sent automatically, and you can read exactly what is attached before it goes anywhere.

## What diagnostics contain

Diagnostics are high-level and about the plugin's own behaviour: which feature ran, what it decided, and any error it hit. They are not a copy of your notes. Before you see or share them, they are **anonymized and redacted**:

| What | What you share instead |
| --- | --- |
| Folder and note names, including inside links | A short stable token per name, e.g. `vault://{3f2a1c}/{a1b2c3}.md`. Folder depth and the file extension stay, so structure is visible without the names. The same note always gets the same token, so a repeated problem with one note is still recognisable. |
| Your home directory and the vault's location on disk | Replaced by `vault://` or `home://`. |
| Property (frontmatter) values | The property **name** and the **type** of its value, e.g. `Attendees: [array:2]`. The value itself is removed. |
| License keys, API keys, tokens, passwords, authorization headers | **Always removed**, in every mode. There is no setting that includes them. |

The `.obsidian` folder marker may remain visible because it explains that a problem involved plugin
configuration. Its descendants — plugin names, profiles, and custom filenames — are tokenized too.

## A complete redaction example

This is an illustrative debug record before and after default redaction. The names and credential
below are made up. The short tokens in the redacted version are examples too: on your device, the
same real folder, note, or heading always receives the same token in a diagnostic bundle, but the
token does not reveal the original name.

**Before sharing — this stays on your device:**

```json
{
  "message": "Could not index C:\\Users\\Ana\\Documents\\Project Atlas\\Clients\\Northwind\\Roadmap 2026.md#Launch plan",
  "filePath": "C:\\Users\\Ana\\Documents\\Project Atlas\\Clients\\Northwind\\Roadmap 2026.md",
  "frontmatter": {
    "Client": "Northwind",
    "Attendees": ["Ana", "Marek"],
    "Budget": 48000
  },
  "configPath": "C:\\Users\\Ana\\Documents\\Project Atlas\\.obsidian\\plugins\\prisma-calendar\\profiles\\client-work.json",
  "request": {
    "Authorization": "Bearer example-access-token-that-is-never-shared",
    "apiKey": "sk_live_example-key-that-is-never-shared"
  }
}
```

**What a default diagnostic contains instead:**

```json
{
  "message": "Could not index vault://{91ad3e}/{6f802b}/{c4e59a}.md#{7b31c0}",
  "filePath": "vault://{91ad3e}/{6f802b}/{c4e59a}.md",
  "frontmatter": {
    "Client": "[string]",
    "Attendees": "[array:2]",
    "Budget": "[number]"
  },
  "configPath": "vault://.obsidian/{4d2e71}/{0b843c}/{e29af5}.json",
  "request": {
    "Authorization": "[redacted:secret]",
    "apiKey": "[redacted:secret]"
  }
}
```

In other words: the support recipient can see that an index operation failed, that the note is three
folders deep, that it is a Markdown file with a heading, which property names and value types were
involved, and that plugin configuration was touched. They cannot see your Windows or macOS account
name, vault location, folder names, note title, heading, property values, configuration profile, or
credentials. The same rules apply to Windows drive paths, macOS volume paths, and network shares.

## Including full detail

Anywhere diagnostics can be shared, an **Include full detail** switch is available. Turning it on
keeps real folder and note names, the vault's location, and property values, so someone you trust can
follow along with your actual setup. Secrets are still removed. The switch restates what it exposes,
and it is off by default. Review the exact attachment before you copy or send it.

## What redaction cannot do

Redaction works on text. A screenshot you attach to a report is not redacted — you see it before sending and decide whether to include it. The message you type yourself is sent as written.

For the legal terms, see the [Privacy Policy](https://matejvavroproductivity.com/privacy/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=content&utm_content=privacy-page).
