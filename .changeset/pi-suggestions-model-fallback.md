---
"@howaboua/pi-suggestions": patch
---

Suggestions fall back to an optional `fallbackModels` list, then the current session model, when the chosen model is unavailable or its request fails.
Suggestion requests opt out of prompt caching, so subscription bridges such as `pi-claude-bridge` can serve them.
