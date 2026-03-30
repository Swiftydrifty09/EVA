# JARVIS AI System

## Overview
A modular AI assistant interface inspired by JARVIS.

## Structure
- index.html → UI
- style.css → Styling
- script.js → Interaction logic
- core/jarvis.js → Core AI logic

## Running
1. Install dependencies: `npm install`
2. Start server: `npm start`
3. In browser, open: `http://localhost:3000`

## Features
- Web chat interface
- Voice speech-to-text and text-to-speech
- Local command parser (greeting, time, date, joke, weather placeholder, open google, clear chat)
- OpenAI backend via `/api/chat` (requires `OPENAI_API_KEY` in `.env`)
- Chat history in localStorage

## Notes
- Do not merge HTML, CSS, and JS into one file.
- Keep modules separated for stability and scaling.
- `server.js` serves from the repo root so `index.html` and assets are accessible.