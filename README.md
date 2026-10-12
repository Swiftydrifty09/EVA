# EVA — Enhanced Virtual Intelligence & Assistance

A modular, local-first virtual assistant. EVA runs a small Node server on your machine and a plain HTML/CSS/JS interface in your browser. It works fully offline in its default mode and can optionally connect to a model provider for open-ended conversation.

**At a glance**

- **Local by default.** No API key, no account, no cloud dependency.
- **Private by design.** Profiles, notes, tasks, and chat history live in your browser's localStorage.
- **Bring your own model.** Ollama, LocalAI, or OpenAI, selected with one environment variable.
- **Constrained tools.** The chat model can call only a short list of read-only server tools. Shell and file tools are never exposed to chat.

---

## Quick Start

```bash
npm install
npm start
```

Open the address printed by the server. The default port is `3000`; override it with `PORT`.

Run the regression tests with:

```bash
npm test
```

---

## Project Structure

| Path | Purpose |
| --- | --- |
| `public/index.html` | User interface |
| `public/style.css` | Styling |
| `public/main.js` | Browser interaction logic |
| `services/server.js` | Web server and AI provider integration |

The Node server serves the browser app from `public/`.

---

## Configuration

Settings live in an ignored `.env` file at the project root. Restart EVA after changing it.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Port the server listens on | `3000` |
| `HOST` | Interface the server binds to | `127.0.0.1` |
| `AI_PROVIDER` | `local`, `ollama`, `localai`, or `openai` | `local` |
| `LOCALAI_BASE_URL` | LocalAI OpenAI-compatible endpoint | none |
| `LOCALAI_MODEL` | Model name as shown by your LocalAI instance | none |
| `LOCALAI_API_KEY` | Only if LocalAI authentication is enabled | empty |

<!-- TODO: document the OpenAI and Ollama environment variables here. -->

> Never put API keys in browser code, and never commit `.env` or any real credentials.

---

## AI Providers

| Provider | Needs | Cost | Open-ended chat | Build mode |
| --- | --- | --- | --- | --- |
| `local` (default) | Nothing | Free | No | No |
| `ollama` | Ollama server reachable by EVA | Free (your hardware) | Yes | Yes |
| `localai` | LocalAI server with an installed model | Free (your hardware) | Yes | Yes |
| `openai` | OpenAI API key | Separate usage charges (not included with a ChatGPT subscription) | Yes | Yes |

**Local mode** supports the built-in command parser and saved profile tools. It does not generate open-ended AI responses or Build proposals. If you cannot use an API or run a model server, local mode is the intended choice.

### LocalAI setup

EVA talks to LocalAI through its OpenAI-compatible chat API. Start LocalAI, install a model there, then add this to `.env`:

```ini
AI_PROVIDER=localai
LOCALAI_BASE_URL=http://127.0.0.1:8080/v1
LOCALAI_MODEL=your-installed-model-name
# Set this only if LocalAI API key authentication is enabled.
LOCALAI_API_KEY=
```

Chat and Build mode share the same configured model. EVA does not install or manage LocalAI models; follow the LocalAI quickstart to run the server and add one.

---

## Security

- **Loopback only by default.** The server binds to `127.0.0.1` and rejects non-local `Host` headers.
- **Remote access is opt-in.** To use a remote development environment's port forward, set `HOST=0.0.0.0` in your ignored `.env` file. This exposes EVA and its coding endpoints to anyone who can reach that port. Use it only in a private, trusted environment.
- **Read-only chat tools.** The model can call only current-time and host CPU/GPU status tools, and the number of tool calls per request is capped.
- **Build never executes.** The Build workspace shows single-file proposals for your review and approval. Shell commands are not executed.
- **No secrets in tracked files.** Keep credentials in `.env`.

---

## Privacy: Where Your Data Goes

| Stays on your device | Sent to your configured AI provider | Requires internet or a third party |
| --- | --- | --- |
| Local commands, calculations, conversions | Chat messages | Weather (Open-Meteo) |
| Profiles, facts, tasks, notes | Your selected response style and AI skill | News (Google News, NPR, BBC News, The Guardian RSS) |
| Daily briefing, saved-data search | Results of any tool the model calls | Place search and map preview (Google Maps) |
| Timers, reminders, stopwatch, aliases | File contents you select in Build mode | Web search |
| Quick scans of text files under 1 MB | | |
| Screen capture preview (not interpreted or uploaded) | | |
| Microphone visualizer (analyzed in-browser) | | |

Profile data is specific to the browser and origin. Clear it through the browser's site-storage settings, or use the explicit clear/delete profile commands.

---

## Features

### Conversation and AI

- Web chat interface with history saved in localStorage
- Stop button to interrupt active AI requests; cancellation is passed through to supported providers
- Response styles: balanced, concise, friendly, formal
- AI skills: general, research analyst, code assistant, tutor, writing coach. Skills guide responses only and grant no additional tool access
- Build workspace for reviewing and approving single-file AI proposals

### Local Command Parser

Works without an API key.

- Greetings, date, jokes, random numbers, and an expanded `help` command
- Local and worldwide time by city or IANA time zone (uses the browser's time-zone data)
- Calculations and offline unit conversions (length, mass, volume, temperature)
- Open sites and web search
- Custom exact-phrase aliases, for example mapping "launch briefing" to "Brief me"

### Productivity

- Timers and reminders with a live countdown, saved locally and restored on your next visit
- Stopwatch with voice/text control; state survives page reloads
- Tasks and notes: review, filter, complete, reopen, delete
- Date-based task reminders ("remind me tomorrow to call Sam")
- On-device daily briefing: local time, overdue and upcoming tasks, active timers, and saved-memory counts. It highlights due dates and does not infer priorities
- On-device search across saved facts, notes, and tasks
- Optional desktop notifications for timers, enabled only after an explicit click

### Profiles and Memory

- Multiple local profiles, each with its own name, spoken voice, remembered facts, tasks, and notes
- Profile changes sync across open tabs of the same origin
- JSON export and import for backups

### Information

- Approximate-location weather (requires location permission)
- U.S. and world headlines aggregated from public RSS feeds
- Place search with inline map preview and Google Maps link, or open your approximate location in Google Maps (location permission is requested only when selected)

### Voice and Audio

- Browser voice input and speech output (requires browser and device support)
- Full-screen voice mode with "repeat that" and "stop listening" shortcuts
- Any installed browser voice, saved per profile, with speed, pitch, and mute controls
- Default voice prefers a feminine-sounding English voice when available
- Voice preview and copy-last-reply action
- Optional microphone-reactive core visualizer; microphone access is requested only when enabled and stops when disabled or when voice mode exits

### Interface

- Cinematic boot sequence: optional, non-blocking, and respects the reduced-motion preference
- Eight saved HUD themes: deep blue, arctic cyan, violet, amber, rose, emerald, crimson, solar gold
- Network status indicator separating offline tools from features that need internet
- Screen capture preview, permission-based; screenshots stay in the browser

### System and Diagnostics

- Live host CPU utilization, plus GPU utilization when `nvidia-smi` (NVIDIA) or `rocm-smi` (AMD) is installed. Readings come from the local Node server
- Local diagnostics: speech support, connection state, CPU/GPU readings, session uptime, command count, and storage usage

### Offline and Installable

- Installable app shell. Open EVA once while online, then install it from the browser's install menu
- Chat, news, weather, and maps still need their respective server or internet access

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Focus chat |
| `Escape` | Close the assistant menu |
| `Ctrl+Shift+V` | Activate full-screen voice mode |

---

## Try These Commands

| Category | Examples |
| --- | --- |
| Briefing | `brief me`, `what should I focus on today` |
| Memory | `remember that I prefer concise answers`, `what do you remember?`, `what did I save about the trip?` |
| Tasks | `create a task: review the release`, `list tasks`, `complete task 1` |
| Notes | `save a note: launch checklist`, `read my last note` |
| Reminders | `remind me tomorrow to call Sam`, `remind me to stretch in 10 seconds` |
| Timers | `set a timer for 5 minutes`, `cancel timers` |
| Time | `What time is it in Tokyo?`, `What time is it in America/Argentina/Buenos_Aires?` |
| Conversion | `convert 5 miles to km` |
| Random | `random number between 1 and 100` |
| Profile | `my name is ...` |

To add profiles or choose a voice for each, open Agent Tools.

---

## Limitations

- **Browser permissions** govern the microphone, location, and screen capture.
- **Timers need the tab.** Browser timers cannot run after the app is fully closed. Desktop notifications are best effort and browser-dependent; completed timers are detected when the page next runs.
- **Speech recognition** availability and offline behavior vary by browser.
- **Hardware metrics** come from the host running the Node server, not the browser's device.
- **Not connected:** hardware control, email, calendar, and OS-level automation.

---

## Development Notes

- Keep HTML, CSS, and JavaScript in separate files. Do not merge them.
- Keep modules separated for stability and scaling.
- Run `npm test` before committing. It covers focused server and local-calculation regression tests.