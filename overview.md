# Configure LLMs UI Update

## Changes Summary

### 1. "Local LLM" → "Custom Endpoint"
Renamed the tab to better reflect that it supports any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, remote proxies, etc.), not just local models.

**Files modified:** index.html, LLMConfigManager.js, ConfigManager.js, MultiAgentSettingsManager.js, ChatBoxSettingsManager.js, ChatManager.js

### 2. Custom Endpoint - Saved Model List
Added save/load functionality specifically for the Custom Endpoint tab's model list:

- **"Save to List" button** next to the custom model name input — saves the entered model name to a persistent list
- **Saved models appear** in a "Saved Custom Models" optgroup in the main model dropdown, so they're quickly selectable
- **Management dropdown** below the input shows all saved models with a delete button
- Data stored in `localStorage('localCustomModels')`

**New methods in LLMConfigManager.js:**
- `getLocalSavedModels()` / `persistLocalSavedModels()` — localStorage read/write
- `refreshLocalSavedModels()` — updates both the optgroup and management dropdown
- `saveLocalCustomModel()` — adds current custom model name to saved list
- `removeLocalCustomModel()` — removes selected model from saved list

### 3. Model List Updates (as of 2026-04-30)

| Provider | New Models | Default Model Change |
|---|---|---|
| OpenAI | GPT-5.5, GPT-5.2-pro, GPT-4.1/mini/nano, o3-pro | gpt-4o → **gpt-5.2** |
| Anthropic | Claude Opus 4.6, Claude Sonnet 4.6, Claude Haiku 4.5 | claude-sonnet-4.5 → **claude-sonnet-4.6** |
| Google | Gemini 2.5 Pro, Gemini 2.5 Flash | gemini-2.0-flash → **gemini-2.5-flash-preview-05-20** |
| DeepSeek | DeepSeek V4 Pro, DeepSeek V4 Flash | deepseek-chat → **deepseek-v4-flash** |
| OpenRouter | Full update: 5.5/5.2-pro/4.1/Claude 4.6/Gemini 2.5/DeepSeek V4 | openai/gpt-4o → **openai/gpt-5.2** |

**Note:** DeepSeek `deepseek-chat` and `deepseek-reasoner` are deprecated (retiring 2026-07-24), now pointing to V4 Flash.
