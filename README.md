# EVA - Enhanced Virtual Intelligence & Assistance

## Overview
A modular, local-first virtual intelligence and assistant.

## Structure
- `public/index.html` → UI
- `public/style.css` → Styling
- `public/main.js` → Browser interaction logic
- `services/server.js` → Web server and AI provider integration

## Running
1. Install dependencies: `npm install`
2. Start the app: `npm start`
3. Open the forwarded port printed by the server (default is `3000`, or the value in `PORT` if you override it).

The server binds to `127.0.0.1` by default and rejects non-local Host headers. To make it reachable through a remote development environment's port forward, set `HOST=0.0.0.0` in your ignored `.env` file. This explicitly exposes EVA and its coding endpoints to anyone who can reach that forwarded port; use only a private, trusted environment. Never store real credentials in tracked files.

## AI Provider
EVA defaults to `AI_PROVIDER=local` and needs no API key. Local mode supports built-in commands and saved profile tools, but does not generate open-ended AI responses or Build proposals. Those features need a model provider.

OpenAI requires an API key and may incur separate usage charges; it is not included with a ChatGPT subscription. Ollama and LocalAI require a model server running on a machine EVA can reach. If you do not use APIs and cannot run a model server, keep EVA in local mode. Never put API keys in browser code or commit them.

## LocalAI
EVA can use a LocalAI server through its OpenAI-compatible chat API. Start LocalAI, install a model there, then set these values in `.env` (replace the model with the name shown by your LocalAI instance):

```dotenv
AI_PROVIDER=localai
LOCALAI_BASE_URL=http://127.0.0.1:8080/v1
LOCALAI_MODEL=your-installed-model-name
# Set this only if LocalAI API key authentication is enabled.
LOCALAI_API_KEY=
```

Restart EVA after changing `.env`. Chat and Build mode use the same configured LocalAI model. EVA does not install or manage LocalAI models; follow the [LocalAI quickstart](https://localai.io/basics/getting_started/) to run the server and add a model.

## Features
- Web chat interface
- Browser voice input and speech output (browser/device support required)
- Interrupt active AI requests with Stop; cancellation is passed through to supported providers, and in-progress browser speech can also be stopped
- Optional, non-blocking cinematic boot sequence; respects the browser's reduced-motion preference
- Local command parser (greeting, local or worldwide time by city/time zone, date, joke, calculation, unit conversion, open sites, web search)
- Local Ollama, LocalAI, or OpenAI backend via `/api/chat`
- AI tool routing for current time and read-only host CPU/GPU status; model tool calls are capped, and shell or file tools are not exposed to chat
- In-app Build workspace for reviewing and approving single-file AI proposals; selected file contents are sent to the configured AI provider, and shell commands are not executed
- Live host CPU utilization and GPU utilization when supported GPU metrics tools are installed (`nvidia-smi` or AMD `rocm-smi`); readings are served by the local Node server
- Chat history in localStorage
- Approximate-location weather from the public Open-Meteo service (requires location permission and internet)
- Search places for an inline map preview and Google Maps link, or open your approximate current location in Google Maps (requires internet; location permission is requested only when selected)
- U.S. and world headlines aggregated from Google News, NPR, BBC News, and The Guardian public RSS feeds (requires internet)
- On-device quick scans for selected text files under 1 MB; file content is not uploaded
- Permission-based screen capture preview; screenshots stay in the browser and are not interpreted or uploaded
- Local timers and reminders (`set a timer for 5 minutes`, `remind me to stretch in 10 seconds`) with a live remaining-time display; timer delivery requires the app tab to remain open
- Offline unit conversions for length, mass, volume, and temperature (for example, `convert 5 miles to km`)
- Installable offline app shell; open EVA once while online, then install it from the browser's app/install menu. Chat, live news, weather, and map lookups still need their respective server or internet access.
- Multiple local profiles with separate names, spoken voices, remembered facts, tasks, and notes stored in browser localStorage; profile changes sync across open tabs of the same origin. Review, filter, complete, reopen, or delete saved items in Agent Tools; export/import a profile JSON backup or explicitly clear/delete profile data. These commands work without an API key and are not sent to the AI server
- On-device daily briefing (`brief me`, `what should I focus on today`) summarizes local time, overdue and upcoming tasks, active timers, and saved-memory counts without making API requests
- On-device search across saved profile facts, notes, and tasks (for example, `what did I save about the trip?`) plus date-based task reminders (for example, `remind me tomorrow to call Sam`); searches and reminders stay in local browser storage and make no API requests
- Voice shortcuts include “repeat that” and “stop listening” in full-screen voice mode
- Browser speech can use any voice installed in the browser, with a separately saved voice selection for each local profile; speech speed, pitch, and mute controls are stored locally
- The default spoken voice prefers a feminine-sounding English browser voice when available; users can choose another installed voice per profile
- Local stopwatch controls in Agent Tools, plus voice/text commands to start, stop, and reset it; elapsed/running state survives page reloads
- Custom exact-phrase command aliases stored in this browser (for example, map “launch briefing” to “Brief me”)
- Local diagnostics for browser speech support, connection state, host CPU/GPU readings, session uptime, command count, and browser storage usage
- Local random number generation (`random number between 1 and 100`) and an expanded local help command
- Locally saved HUD themes (deep blue, arctic cyan, violet, amber, rose, emerald, crimson, and solar gold)
- Assistant response styles (balanced, concise, friendly, and formal) and AI skills (general, research analyst, code assistant, tutor, and writing coach) are sent as fixed allowlisted preferences with chat requests and saved in this browser. Skills guide responses but do not grant additional tool access; chat models can call only the listed read-only server tools. Requests and any tool results go to the configured AI provider; on-device commands remain in this browser
- Optional microphone-reactive core visualizer; microphone access is requested only when enabled, audio is analyzed in-browser, and capture stops when disabled or voice mode exits
- Network status indicator distinguishes offline local tools from features that need internet access
- Keyboard shortcuts: `Ctrl+K` focuses chat, `Escape` closes the assistant menu, and `Ctrl+Shift+V` activates full-screen voice mode
- Browser speech includes voice preview and copy-last-reply clipboard action
- Optional desktop notifications for timers, enabled only after an explicit user click
- Cancel timers with `cancel timers`; timers are saved locally and restored on the next visit. Remaining time updates while EVA is open and expired timers are checked when the tab becomes visible.

## Notes
- Do not merge HTML, CSS, and JS into one file.
- Keep modules separated for stability and scaling.
- The Node server serves the browser app from `public/`.
- Browser permission prompts govern microphone, location, and screen capture. The system monitor reads CPU counters from the host running the Node server; GPU utilization requires NVIDIA `nvidia-smi` or AMD `rocm-smi`. Hardware control, email, calendar, and OS-level automation are not connected.
- Browser timers cannot run after the app is fully closed; desktop notifications are best effort and browser-dependent. Completed timers are detected when the page next runs.
- The microphone visualizer needs browser microphone permission and Web Audio support. Browser speech recognition availability and offline behavior vary by browser; weather, news, maps, and web search require internet access.
- Run `npm test` for the focused server and local-calculation regression tests.
- Try “brief me”, “what did I save about the trip?”, “remind me tomorrow to call Sam”, “remember that I prefer concise answers”, “what do you remember?”, “create a task: review the release”, “list tasks”, “complete task 1”, “save a note: launch checklist”, and “read my last note”. Briefings, saved-data searches, and date-based reminders use local browser data only and make no API requests. The briefing does not infer priorities beyond highlighting due dates. Add profiles in Agent Tools, select a different voice for each, and switch profiles there or say “my name is …” to update the active profile name. Profile data is specific to this browser and can be cleared through its site-storage settings.
- Ask “What time is it in Tokyo?” or use an IANA time zone such as “What time is it in America/Argentina/Buenos_Aires?”. World-clock answers use the browser’s built-in time-zone data and do not require an API key.