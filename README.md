# JARVIS AI System

## Overview
A modular AI assistant interface inspired by JARVIS.

## Structure
- `public/index.html` → UI
- `public/style.css` → Styling
- `public/main.js` → Browser interaction logic
- `services/server.js` → Web server and AI provider integration

## Running
1. Install dependencies: `npm install`
2. Start the app: `npm start`
3. Open the forwarded port printed by the server (usually `3100`).

## Local AI with Ollama
1. Install Ollama and download the model: `ollama pull jarvis-tech/Jarvis_Distilled_v1:latest`
2. Copy `.env.example` to `.env` and adjust `OLLAMA_MODEL` if needed.
3. Keep Ollama running, then start the app with `npm start`.

The app sends recent chat context to Ollama on your machine. It does not need an API key. If Ollama is unavailable, JARVIS falls back to local commands and displays a warning. To use OpenAI instead, set `AI_PROVIDER=openai` and `OPENAI_API_KEY` in `.env`; `AI_PROVIDER=local` disables hosted/local LLM calls.

## Features
- Web chat interface
- Browser voice input and speech output (browser/device support required)
- Local command parser (greeting, time, date, joke, calculation, open sites, web search)
- Local Ollama or OpenAI backend via `/api/chat`
- Chat history in localStorage
- Approximate-location weather from the public Open-Meteo service (requires location permission and internet)
- U.S. and world headlines aggregated from Google News, NPR, BBC News, and The Guardian public RSS feeds (requires internet)
- On-device quick scans for selected text files under 1 MB; file content is not uploaded
- Permission-based screen capture preview; screenshots stay in the browser and are not interpreted or uploaded
- Local timers and reminders (`set a timer for 5 minutes`, `remind me to stretch in 10 seconds`); timer delivery requires the app tab to remain open
- Browser speech uses only Google US English voice 4 when installed; includes voice preview and copy-last-reply clipboard action
- Optional desktop notifications for timers, enabled only after an explicit user click
- Cancel timers with `cancel timers`; timers are saved locally and restored on the next visit

## Notes
- Do not merge HTML, CSS, and JS into one file.
- Keep modules separated for stability and scaling.
- The Node server serves the browser app from `public/`.
- Browser permission prompts govern microphone, location, and screen capture. Hardware, email, calendar, and OS-level automation are not connected.
- Browser timers cannot run after the app is fully closed; desktop notifications are best effort and browser-dependent. Completed timers are detected when the page next runs.