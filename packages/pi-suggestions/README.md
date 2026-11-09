# Suggestions

Suggested next steps in Pi's terminal editor, phrased as requests you can send. Suggestions appear as dim text after a completed response, only while the editor is empty. They are drafts, not automatic follow-up requests.

## Install

```sh
pi install npm:@howaboua/pi-suggestions
```

Requires Pi 1.3 or later. Included in `pi-extensions` and `pi-stuff`.

## Set up

Open `/suggestions`, choose a model and switch suggestions on. They start off, with no model selected. The menu also offers supported reasoning levels, model search and an off switch. These settings are global; they do not change the main chat model.

Suggestions use the selected model's quota and may incur API charges. They send that provider bounded excerpts of user messages and completed assistant responses, including a compaction summary when available. Tool results, images and the main chat's hidden reasoning are excluded.

Predictions keep a separate, in-memory conversation without tools. Later requests append new conversation turns. Requests opt out of prompt caching, like Pi's own summaries, so subscription bridges such as `pi-claude-bridge` accept them. This private history never enters your chat and is discarded on a new Notes context window, Pi compaction, session navigation, model changes, switching suggestions off or shutdown.

Suggestions run only in interactive terminal sessions. Shepherdr-launched workers and Pi's RPC and print modes do not request them. Update Shepherdr alongside Suggestions to identify workers reliably.

## Use

- **Right arrow** accepts the visible suggestion into the editor. Fill any placeholders, edit normally and press **Enter** to send.
- **Tab** keeps Pi's normal behaviour.
- **Escape** dismisses it. Typing replaces it with your own input.
- **Enter** alone never submits a suggestion.

Input, navigation, new responses and blocking dialogs cancel pending suggestions. Long suggestions are visually shortened to fit the editor; accepting inserts the complete draft.

Suggestions require the standard empty editor layout. Custom editors with a different layout remain usable but may not display suggestions. Settings are stored in `suggestions/config.json` under Pi's agent directory.

## Fallback models

If the chosen model is unavailable or its request fails, suggestions try each `provider/id` in the optional `fallbackModels` list, then the current session model. Add the list to `suggestions/config.json` directly; `/suggestions` keeps it when you change other settings. This lets one settings file work on machines with different providers:

```json
{
	"enabled": true,
	"model": {
		"provider": "opencode-go",
		"id": "glm-5.3-flash",
		"reasoning": "low"
	},
	"fallbackModels": ["anthropic/claude-haiku-5-5"]
}
```

The chosen reasoning level applies to fallbacks that support it. Switching models starts a new private prediction history.

## Customise suggestions

Open `/suggestions` and choose **Instructions** to edit the Markdown guidance. You can also edit `suggestions/instructions.md` under Pi's agent directory directly. Changes apply to the next prediction and reset its private history. They do not change the main chat's prompt.

The file starts with short defaults: suggest productive next actions, avoid repeating either participant or re-suggesting work, and skip routine requests for hashes, summaries or more verification unless they unblock progress. Add, replace or remove these instructions to suit your workflow. An empty file leaves only the built-in request-format instructions. Deleting the file restores the defaults on the next prediction or when you open **Instructions**.
