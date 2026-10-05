const chat = document.getElementById("chat");
const composer = document.getElementById("composer");
const input = document.getElementById("input");
const coreVisual = document.getElementById("core-visual");
const coreCaption = document.getElementById("core-caption");
const coreState = document.getElementById("core-state");
const voiceButton = document.getElementById("voice-button");
const voiceModeEnter = document.getElementById("voice-mode-enter");
const voiceModeExit = document.getElementById("voice-mode-exit");
const appShell = document.querySelector(".app-shell");
const voiceStatus = document.getElementById("voice-status");
const toolStatus = document.getElementById("tool-status");
const fileInput = document.getElementById("file-input");
const voiceSelect = document.getElementById("voice-select");
const timerList = document.getElementById("timer-list");
const speechSupported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
const timerStorageKey = "jarvis-timers";
const speechVoiceKey = "jarvis-speech-voice";
const isGoogleEnglishVoice = (voice) =>
  /\bgoogle\b/i.test(voice.name) && /^en[-_]/i.test(voice.lang);
const isVoiceFour = (voice) =>
  isGoogleEnglishVoice(voice) && /^Google US English 4(?:\b.*)?$/i.test(voice.name);
let recognition;
let responseTimer;
let timers = loadTimers();
let isProcessing = false;
let isSpeaking = false;
let isListening = false;
let speechSequence = 0;
let voiceOnlyMode = false;
let speechPending = false;
let voiceRestartTimer;
let voiceModeInputFailed = false;

function addMessage(text, sender, timestamp = new Date(), persist = true) {
  const message = document.createElement("article");
  message.className = `message message-${sender}`;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = sender === "user" ? "YOU" : "JARVIS";

  const body = document.createElement("p");
  body.className = "message-body";
  body.textContent = text;

  const time = document.createElement("time");
  time.className = "message-time";
  time.dateTime = timestamp.toISOString();
  time.textContent = timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  message.append(meta, body, time);
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;

  if (persist) {
    try {
      const history = JSON.parse(localStorage.getItem("jarvis-chat") || "[]");
      history.push({ text, sender, timestamp: timestamp.toISOString() });
      localStorage.setItem("jarvis-chat", JSON.stringify(history.slice(-80)));
    } catch {
      // Storage is optional.
    }
  }
}

function restoreMessages() {
  try {
    const history = JSON.parse(localStorage.getItem("jarvis-chat") || "[]");
    history.forEach((entry) => {
      addMessage(entry.text, entry.sender, new Date(entry.timestamp), false);
    });
  } catch {
    try {
      localStorage.removeItem("jarvis-chat");
    } catch {
      // Storage is optional.
    }
  }

  if (chat.childElementCount === 0) {
    addMessage("Good day. Local systems are ready. Ask for the time, set a timer, get weather or headlines, or open Agent Tools for file and screen utilities.", "assistant");
  }
}

function parseCalculation(expression) {
  const tokens = expression.match(/\d*\.?\d+|[()+\-*/%]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) {
    throw new Error("Invalid calculation");
  }

  let position = 0;

  function parseExpression() {
    let value = parseTerm();
    while (["+", "-"].includes(tokens[position])) {
      const operator = tokens[position++];
      const next = parseTerm();
      value = operator === "+" ? value + next : value - next;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (["*", "/", "%"].includes(tokens[position])) {
      const operator = tokens[position++];
      const next = parseFactor();
      if ((operator === "/" || operator === "%") && next === 0) {
        throw new Error("Cannot divide by zero");
      }
      value = operator === "*" ? value * next : operator === "/" ? value / next : value % next;
    }
    return value;
  }

  function parseFactor() {
    const token = tokens[position++];
    if (token === "+") return parseFactor();
    if (token === "-") return -parseFactor();
    if (token === "(") {
      const value = parseExpression();
      if (tokens[position++] !== ")") {
        throw new Error("Unclosed parenthesis");
      }
      return value;
    }

    const number = Number(token);
    if (!Number.isFinite(number)) {
      throw new Error("Expected a number");
    }
    return number;
  }

  const result = parseExpression();
  if (position !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Invalid calculation");
  }

  return Number(result.toPrecision(12));
}

function getReply(message) {
  const normalized = message.trim().toLowerCase();
  const calculation = normalized.match(/^(?:calculate|what is|compute)\s+(.+?)[?!.]*$/);

  if (/\b(hello|hi|hey)\b/.test(normalized)) return "Hello. All local systems are ready.";
  if (/\b(time|clock)\b/.test(normalized)) return `The local time is ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.`;
  if (/\b(date|day|today)\b/.test(normalized)) return `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  if (/\b(joke|make me laugh)\b/.test(normalized)) return "I told my computer I needed a break. It said: 'No problem, I'll go to sleep.'";
  if (/\b(who are you|your name)\b/.test(normalized)) return "I am JARVIS, your local assistant. I can handle a few useful commands without connecting to an AI service.";
  if (/\b(help|commands|what can you do)\b/.test(normalized)) return "Try: 'What time is it?', 'What is 24 * (3 + 2)?', 'Set a timer for 5 minutes', 'Remind me to stretch in 10 seconds', 'weather', or 'news'. Use Agent Tools for file scans, screen capture, voice selection, and clipboard.";
  if (/\b(clear|clear chat|clear conversation)\b/.test(normalized)) {
    clearConversation();
    return "Conversation cleared.";
  }

  if (calculation) {
    try {
      return `${calculation[1]} = ${parseCalculation(calculation[1])}`;
    } catch (error) {
      return `I could not calculate that: ${error.message}.`;
    }
  }

  const search = normalized.match(/^(?:search(?: the web)? for|look up)\s+(.+)$/);
  if (search) {
    return `Searching the web for “${search[1]}”.`;
  }

  const open = normalized.match(/^open\s+(google|youtube|wikipedia|maps)$/);
  if (open) {
    return `Opening ${open[1]}.`;
  }

  return "I am running without an AI service, so I cannot answer open-ended questions yet. I can tell the time or date, calculate expressions, tell a joke, and open or search the web. Say 'help' for examples.";
}

function getOpenTarget(message) {
  const normalized = message.trim().replace(/[?.!]+$/, "").toLowerCase();
  const search = normalized.match(/^(?:search(?: the web)? for|look up)\s+(.+)$/);
  if (search) return `https://www.google.com/search?q=${encodeURIComponent(search[1])}`;

  const open = normalized.match(/^open\s+(?:the\s+)?(.+)$/);
  if (!open) return null;

  const destination = open[1].replace(/^www\./, "").trim();
  const sites = {
    google: "https://www.google.com",
    youtube: "https://www.youtube.com",
    wikipedia: "https://www.wikipedia.org",
    maps: "https://maps.google.com",
    "google maps": "https://maps.google.com",
    gmail: "https://mail.google.com",
    email: "https://mail.google.com",
    "my email": "https://mail.google.com",
    drive: "https://drive.google.com",
    "google drive": "https://drive.google.com",
    docs: "https://docs.google.com",
    "google docs": "https://docs.google.com",
    calendar: "https://calendar.google.com",
    reddit: "https://www.reddit.com",
    instagram: "https://www.instagram.com",
    facebook: "https://www.facebook.com",
    twitter: "https://x.com",
    x: "https://x.com",
    amazon: "https://www.amazon.com",
    netflix: "https://www.netflix.com",
    spotify: "https://open.spotify.com",
    github: "https://github.com",
    discord: "https://discord.com",
    twitch: "https://www.twitch.tv",
    tiktok: "https://www.tiktok.com",
    linkedin: "https://www.linkedin.com",
    bing: "https://www.bing.com",
    yahoo: "https://www.yahoo.com",
    outlook: "https://outlook.live.com",
    "microsoft outlook": "https://outlook.live.com",
    chatgpt: "https://chatgpt.com"
  };
  if (sites[destination]) return sites[destination];

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(destination) ? destination : `https://${destination}`);
    if (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !/(^|\.)(localhost|local|internal)$/i.test(url.hostname)
    ) {
      url.protocol = "https:";
      return url.href;
    }
  } catch {
    // Unrecognized names are opened as a web search below.
  }

  return `https://www.google.com/search?q=${encodeURIComponent(destination)}`;
}

function getLocalClockReply(message) {
  const normalized = message.trim().toLowerCase();
  const timeRequest = /^(?:(?:what(?:'s| is)? )?(?:the )?time(?: is it)?|tell me (?:the )?time|current time|local time|clock)(?: please)?[?.!]*$/;
  const dateRequest = /^(?:(?:what(?:'s| is) )?(?:the )?date(?: is it)?|tell me (?:the )?date|today(?:'s)? date|what day is it)(?: please)?[?.!]*$/;

  if (timeRequest.test(normalized)) {
    return `The local time is ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.`;
  }
  if (dateRequest.test(normalized)) {
    return `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  }
  return null;
}

async function speak(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    toolStatus.textContent = "Speech output is not supported by this browser.";
    return;
  }

  const sequence = ++speechSequence;
  window.speechSynthesis.cancel();
  isSpeaking = false;
  speechPending = true;
  renderAssistantState();

  let voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    voices = await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(window.speechSynthesis.getVoices());
      };
      const onVoicesChanged = () => finish();
      const timeout = setTimeout(finish, 2000);
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged, { once: true });
    });
  }

  if (sequence !== speechSequence) return;
  const voice = voices.find(isVoiceFour);
  if (!voice) {
    speechPending = false;
    toolStatus.textContent = "Google US English voice 4 is unavailable in this browser.";
    scheduleVoiceListening();
    return;
  }

  if (voiceSelect.value !== voice.name) {
    voiceSelect.value = voice.name;
    try {
      localStorage.setItem(speechVoiceKey, voice.name);
    } catch {
      // The selected voice remains active for this session.
    }
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 1.12;
  utterance.onstart = () => {
    if (sequence !== speechSequence) return;
    isSpeaking = true;
    renderAssistantState();
    toolStatus.textContent = `Speaking with ${voice.name}.`;
  };
  utterance.onend = () => {
    if (sequence !== speechSequence) return;
    isSpeaking = false;
    speechPending = false;
    renderAssistantState();
    scheduleVoiceListening();
  };
  utterance.onerror = (event) => {
    if (sequence !== speechSequence) return;
    isSpeaking = false;
    speechPending = false;
    renderAssistantState();
    toolStatus.textContent = `Speech playback failed: ${event.error || "the browser stopped playback"}.`;
    scheduleVoiceListening();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    speechPending = false;
    toolStatus.textContent = `Speech playback failed: ${error.message}`;
    scheduleVoiceListening();
  }
}

function populateSpeechVoices() {
  if (!("speechSynthesis" in window)) {
    voiceSelect.disabled = true;
    voiceSelect.innerHTML = "<option value=\"\">Speech synthesis unavailable</option>";
    return;
  }

  let savedVoice = "";
  try {
    savedVoice = localStorage.getItem(speechVoiceKey) || "";
  } catch {
    // Speech settings remain usable even when browser storage is unavailable.
  }
  const selectedVoice = voiceSelect.value || savedVoice;
  const allVoices = window.speechSynthesis.getVoices();
  const voices = allVoices.filter(isVoiceFour);
  voiceSelect.replaceChildren();
  if (voices.length === 0) {
    voiceSelect.add(new Option("Google US English voice 4 unavailable", ""));
    voiceSelect.disabled = true;
    toolStatus.textContent = "Google US English voice 4 is unavailable in this browser.";
    return;
  }
  voiceSelect.disabled = false;
  voices.forEach((voice) => {
    voiceSelect.add(new Option(`${voice.name} (${voice.lang})`, voice.name));
  });
  if (voices.some((voice) => voice.name === selectedVoice)) {
    voiceSelect.value = selectedVoice;
  } else {
    voiceSelect.value = voices[0].name;
    try {
      localStorage.setItem(speechVoiceKey, voices[0].name);
    } catch {
      // The voice remains selected for this session.
    }
  }
  const selected = voices.find((voice) => voice.name === voiceSelect.value);
  if (selected) toolStatus.textContent = `Google English voice ready: ${selected.name}.`;
}

function loadTimers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(timerStorageKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((timer) =>
          typeof timer.id === "string" &&
          typeof timer.label === "string" &&
          Number.isFinite(timer.dueAt) &&
          timer.dueAt > 0
        ).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function saveTimers() {
  try {
    localStorage.setItem(timerStorageKey, JSON.stringify(timers));
  } catch {
    toolStatus.textContent = "Timer is active in this tab, but browser storage is unavailable so it won't survive a refresh.";
  }
}

function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    remainingSeconds || (!hours && !minutes) ? `${remainingSeconds}s` : ""
  ].filter(Boolean).join(" ");
}

function renderTimers() {
  timerList.replaceChildren();
  timers.forEach((timer) => {
    const row = document.createElement("div");
    row.className = "timer-row";
    const label = document.createElement("span");
    label.textContent = `${timer.label} · ${new Date(timer.dueAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "timer-cancel";
    cancel.textContent = "×";
    cancel.setAttribute("aria-label", `Cancel ${timer.label}`);
    cancel.addEventListener("click", () => {
      timers = timers.filter((item) => item.id !== timer.id);
      saveTimers();
      renderTimers();
      toolStatus.textContent = "Timer cancelled.";
    });
    row.append(label, cancel);
    timerList.append(row);
  });
}

function addTimer(label, duration) {
  if (timers.length >= 20) {
    addToolCard("TIMER LIMIT", "There are already 20 active timers. Cancel one before adding another.");
    return;
  }

  const timer = { id: crypto.randomUUID(), label, dueAt: Date.now() + duration };
  timers.push(timer);
  saveTimers();
  renderTimers();
  const message = `${label} set for ${formatDuration(duration)}. It will alert while this page is open; notifications can be enabled below.`;
  addToolCard("TIMER SET", message);
  speak(message);
}

function checkTimers() {
  const now = Date.now();
  const due = timers.filter((timer) => timer.dueAt <= now);
  if (!due.length) return;

  const dueIds = new Set(due.map((timer) => timer.id));
  timers = timers.filter((timer) => !dueIds.has(timer.id));
  saveTimers();
  renderTimers();

  due.forEach((timer) => {
    const message = `${timer.label} timer is complete.`;
    addToolCard("TIMER COMPLETE", message);
    speak(message);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("JARVIS timer", { body: message });
    }
  });
}

function parseTimerRequest(message) {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (/^(?:cancel|clear) (?:all )?(?:timers?|reminders?)$/.test(normalized)) {
    return { cancelAll: true };
  }

  const reminder = normalized.match(/^remind me to (.+?) in (\d{1,5})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)$/);
  const timer = normalized.match(/^(?:set )?(?:a )?timer for (\d{1,5})\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)(?: to (.+))?$/);
  const match = reminder || timer;
  if (!match) return null;

  const amount = Number(match[reminder ? 2 : 1]);
  const unit = match[reminder ? 3 : 2];
  const multiplier = /^h/.test(unit) ? 3600000 : /^m/.test(unit) ? 60000 : 1000;
  const duration = amount * multiplier;
  if (!Number.isSafeInteger(duration) || duration < 1000 || duration > 30 * 24 * 3600000) {
    return { error: "Choose a timer from 1 second up to 30 days." };
  }

  const label = reminder ? match[1] : match[3] || "Timer";
  return { label: label.trim().slice(0, 100), duration };
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toolStatus.textContent = "This browser doesn't support desktop notifications. Timer alerts still appear in JARVIS while this tab is open.";
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    toolStatus.textContent = permission === "granted"
      ? "Timer notifications enabled. This page must stay open for timers to fire."
      : "Notifications were not enabled; timers still alert inside JARVIS while this tab is open.";
  } catch (error) {
    toolStatus.textContent = `Could not enable notifications. ${error.message}`;
  }
}

function addToolCard(title, description) {
  const message = document.createElement("article");
  message.className = "message message-assistant tool-message";

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = title;

  const body = document.createElement("p");
  body.className = "message-body";
  body.textContent = description;

  message.append(meta, body);
  chat.append(message);
  chat.scrollTop = chat.scrollHeight;
  return message;
}

function weatherLabel(code) {
  if (code === 0) return "clear skies";
  if ([1, 2, 3].includes(code)) return "partly cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunderstorms";
  return "conditions unavailable";
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 12000
    });
  });
}

async function showWeather() {
  toolStatus.textContent = "Requesting approximate location for weather…";
  try {
    const position = await getPosition();
    const latitude = position.coords.latitude.toFixed(2);
    const longitude = position.coords.longitude.toFixed(2);
    const params = new URLSearchParams({
      latitude,
      longitude,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
      timezone: "auto"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather feed returned HTTP ${response.status}.`);
    const data = await response.json();
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) {
      throw new Error("Weather feed did not return current conditions.");
    }

    const temperatureUnit = data.current_units?.temperature_2m || "°C";
    const windUnit = data.current_units?.wind_speed_10m || "km/h";
    const description = `Current conditions near you: ${weatherLabel(current.weather_code)}, ${current.temperature_2m}${temperatureUnit}, humidity ${current.relative_humidity_2m}%, wind ${current.wind_speed_10m} ${windUnit}. Approximate coordinates were shared with Open-Meteo.`;
    addToolCard("LIVE WEATHER · OPEN-METEO", description);
    toolStatus.textContent = "Weather updated from Open-Meteo. Location was rounded to about 1 km.";
    speak(description);
  } catch (error) {
    const reason = error.code === 1
      ? "Location permission was denied. Allow location access and try again."
      : error.message || "Weather could not be loaded.";
    addToolCard("WEATHER UNAVAILABLE", reason);
    toolStatus.textContent = "Weather unavailable. No location is stored.";
    speak(reason);
  }
}

async function showHeadlines() {
  toolStatus.textContent = "Checking worldwide news feeds…";
  try {
    const response = await fetch("/api/news");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Headlines request failed (HTTP ${response.status}).`);

    const card = addToolCard("LIVE HEADLINES · U.S. + WORLD", "");
    const list = document.createElement("ul");
    list.className = "headline-list";
    data.headlines.forEach((headline) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = headline.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = headline.title;
      const source = document.createElement("span");
      source.className = "headline-source";
      source.textContent = headline.source;
      item.append(link, source);
      list.append(item);
    });
    card.append(list);
    toolStatus.textContent = `Worldwide headlines from ${data.sources.join(", ")}.`;
    speak(`Here are the latest ${data.source} headlines. ${data.headlines.slice(0, 3).map((headline) => headline.title).join(". ")}`);
  } catch (error) {
    addToolCard("HEADLINES UNAVAILABLE", error.message);
    toolStatus.textContent = "Could not reach the public news feed.";
    speak(error.message);
  }
}

const ignoredWords = new Set(
  "about after again also and are because been before being between both could does doing down each from have into just more most other over same some such than that the their them then there these they this those through under very was were what when where which while will with would your".split(" ")
);

async function scanSelectedFile(file) {
  if (!file) return;
  if (file.size > 1024 * 1024) {
    addToolCard("FILE NOT SCANNED", "Choose a text file smaller than 1 MB.");
    return;
  }

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
    const frequencies = new Map();
    words.forEach((word) => {
      const normalized = word.toLocaleLowerCase();
      if (normalized.length >= 4 && !ignoredWords.has(normalized)) {
        frequencies.set(normalized, (frequencies.get(normalized) || 0) + 1);
      }
    });
    const keywords = [...frequencies.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([word]) => word);
    const headings = lines
      .filter((line) => /^#{1,6}\s+\S/.test(line) || (/^[A-Z\d][A-Z\d \-:]{5,}$/.test(line.trim()) && line.trim().length < 100))
      .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
      .slice(0, 4);

    const details = [
      `${file.name} · ${words.length.toLocaleString()} words · ${lines.length.toLocaleString()} lines.`,
      headings.length ? `Headings: ${headings.join(" · ")}.` : "",
      keywords.length ? `Frequent terms: ${keywords.join(", ")}.` : "No recurring terms found."
    ].filter(Boolean).join(" ");
    addToolCard("LOCAL FILE SCAN", `${details} Basic on-device scan only; file contents were not uploaded or saved.`);
    toolStatus.textContent = "File scanned locally in your browser; its contents were not sent to a server.";
    speak(`Local scan complete. ${words.length} words. ${keywords.length ? `Frequent terms: ${keywords.join(", ")}.` : ""}`);
  } catch (error) {
    addToolCard("FILE SCAN FAILED", `Could not read this file. ${error.message}`);
    toolStatus.textContent = "Could not read the selected file.";
    speak("I could not read that file.");
  } finally {
    fileInput.value = "";
  }
}

async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    addToolCard("SCREEN CAPTURE UNAVAILABLE", "This browser does not support screen sharing. Try a secure browser context.");
    return;
  }

  let stream;
  toolStatus.textContent = "Choose a screen or window in the browser permission prompt…";
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((resolve) => {
      if (video.videoWidth) resolve();
      else video.addEventListener("loadedmetadata", resolve, { once: true });
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const preview = document.createElement("img");
    preview.className = "screen-preview";
    preview.alt = "Screen capture preview. It is only visible in this browser and was not uploaded.";
    preview.src = canvas.toDataURL("image/jpeg", 0.72);

    const card = addToolCard("LOCAL SCREEN CAPTURE", "Preview only. This no-key setup does not visually interpret the image, and the screenshot was not uploaded or saved.");
    card.append(preview);
    toolStatus.textContent = "Screen preview captured locally. Choose what to share in the browser prompt.";
    speak("Screen preview captured locally. It was not uploaded, and I cannot interpret the image in this setup.");
  } catch (error) {
    addToolCard("SCREEN CAPTURE CANCELLED", error.name === "NotAllowedError" ? "No screen was shared." : `Could not capture the screen. ${error.message}`);
    toolStatus.textContent = "Screen capture cancelled or unavailable.";
    if (error.name !== "NotAllowedError") speak("I could not capture the screen.");
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

function scheduleVoiceListening() {
  clearTimeout(voiceRestartTimer);
  if (!voiceOnlyMode || voiceModeInputFailed || isListening || isProcessing || isSpeaking || speechPending) return;
  voiceRestartTimer = setTimeout(() => startVoiceRecognition(true), 800);
}

function startVoiceRecognition(autoRestart = false) {
  if (!speechSupported) {
    toolStatus.textContent = "Voice input is not supported in this browser.";
    voiceModeInputFailed = voiceOnlyMode;
    renderAssistantState();
    return;
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new Recognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = false;
  voiceButton.classList.add("is-listening");
  voiceButton.textContent = "LISTENING";
  isListening = true;
  renderAssistantState();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (voiceOnlyMode && /^(?:(?:please\s+)?(?:exit|leave|close|quit)(?:\s+the)?\s+(?:full[\s-]?screen\s+)?(?:voice|assistant)?\s*mode|go back|return to dashboard)[?.!]*$/i.test(transcript)) {
      exitVoiceOnlyMode();
      return;
    }
    sendMessage(transcript);
  };
  recognition.onerror = (event) => {
    if (voiceOnlyMode) {
      toolStatus.textContent = `Voice input failed: ${event.error || "microphone unavailable"}.`;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        voiceModeInputFailed = true;
      }
    } else {
      addMessage("I could not hear that. Check microphone permission and try again.", "assistant");
    }
  };
  recognition.onend = () => {
    voiceButton.classList.remove("is-listening");
    voiceButton.textContent = "VOICE";
    isListening = false;
    renderAssistantState();
    if (autoRestart || voiceOnlyMode) scheduleVoiceListening();
  };

  try {
    recognition.start();
  } catch (error) {
    isListening = false;
    voiceButton.classList.remove("is-listening");
    voiceButton.textContent = "VOICE";
    if (voiceOnlyMode) {
      voiceModeInputFailed = true;
      toolStatus.textContent = `Could not start voice input: ${error.message}`;
    } else {
      addMessage("Voice input is already listening. Please try again in a moment.", "assistant");
    }
    renderAssistantState();
  }
}

function enterVoiceOnlyMode() {
  if (!speechSupported) {
    addMessage("Voice input is not supported in this browser. You can still use the regular dashboard.", "assistant");
    return;
  }

  voiceOnlyMode = true;
  voiceModeInputFailed = false;
  appShell.classList.add("is-voice-only");
  renderAssistantState();
  let fullscreenRequest;
  try {
    fullscreenRequest = appShell.requestFullscreen?.();
  } catch (error) {
    toolStatus.textContent = `Full-screen mode is unavailable: ${error.message}`;
  }
  startVoiceRecognition();
  fullscreenRequest?.catch((error) => {
    toolStatus.textContent = `Full-screen mode is unavailable: ${error.message}`;
  });
}

function exitVoiceOnlyMode() {
  voiceOnlyMode = false;
  voiceModeInputFailed = false;
  clearTimeout(voiceRestartTimer);
  appShell.classList.remove("is-voice-only");
  if (recognition && isListening) recognition.stop();
  if (speechPending && "speechSynthesis" in window) {
    ++speechSequence;
    window.speechSynthesis.cancel();
    speechPending = false;
    isSpeaking = false;
  }
  if (document.fullscreenElement === appShell) {
    document.exitFullscreen().catch((error) => {
      toolStatus.textContent = `Could not leave full-screen mode: ${error.message}`;
    });
  }
  renderAssistantState();
}

function renderAssistantState() {
  const active = isProcessing || isSpeaking || isListening;
  coreVisual.classList.toggle("is-active", active);
  coreVisual.classList.toggle("is-speaking", isSpeaking);
  coreVisual.closest(".core-panel").classList.toggle("is-active", active);
  const waveform = document.getElementById("waveform");
  waveform.classList.toggle("is-active", active);
  waveform.classList.toggle("is-speaking", isSpeaking);
  coreVisual.closest(".core-panel").classList.toggle("is-speaking", isSpeaking);
  coreCaption.textContent = isListening
    ? "LISTENING"
    : isSpeaking
      ? "SPEAKING"
      : isProcessing
        ? "GENERATING RESPONSE"
        : voiceOnlyMode
          ? voiceModeInputFailed
            ? "MICROPHONE UNAVAILABLE · PRESS EXIT TO RETURN"
            : "SAY A COMMAND · SAY “EXIT VOICE MODE” TO RETURN"
          : "SYSTEM READY";
  coreState.textContent = isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : active ? "ACTIVE" : "STANDBY";
}

function setActive(active) {
  clearTimeout(responseTimer);
  isProcessing = active;
  renderAssistantState();
  if (!active) scheduleVoiceListening();
}

function clearConversation() {
  chat.replaceChildren();
  try {
    localStorage.removeItem("jarvis-chat");
  } catch {
    // Storage is optional.
  }
}

function getConversationHistory() {
  return Array.from(chat.querySelectorAll(".message:not(.tool-message)")).slice(-20).map((message) => ({
    role: message.classList.contains("message-user") ? "user" : "assistant",
    content: message.querySelector(".message-body").textContent
  }));
}

async function sendMessage(message) {
  const text = message.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  setActive(true);

  const isOpenCommand = /^open\b/i.test(text);
  const target = getOpenTarget(text);
  if (isOpenCommand && target) {
    window.open(target, "_blank", "noopener,noreferrer");
    const destination = target.includes("/search?")
      ? `a web search for ${text.replace(/^open\s+(?:the\s+)?/i, "").replace(/[?.!]+$/, "")}`
      : new URL(target).hostname.replace(/^www\./, "");
    const reply = `Opening ${destination} in a new tab.`;
    addMessage(reply, "assistant");
    speak(reply);
    setActive(false);
    return;
  }
  if (target) {
    window.open(target, "_blank", "noopener,noreferrer");
  }

  const localClockReply = getLocalClockReply(text);
  if (localClockReply) {
    addMessage(localClockReply, "assistant");
    speak(localClockReply);
    setActive(false);
    return;
  }

  const normalized = text.toLowerCase();
  if (/\b(weather|temperature|forecast)\b/.test(normalized)) {
    await showWeather();
    setActive(false);
    return;
  }
  if (/\b(news|headlines)\b/.test(normalized)) {
    await showHeadlines();
    setActive(false);
    return;
  }
  if (/\b(scan|summari[sz]e|analy[sz]e)\b.*\b(file|document|text)\b/.test(normalized)) {
    addToolCard("LOCAL FILE TOOL", "Use the Scan a text file control. JARVIS will count words, find headings, and identify frequent terms entirely in this browser.");
    setActive(false);
    return;
  }
  if (/\b(capture|share|show)\b.*\b(screen|display|desktop)\b/.test(normalized)) {
    addToolCard("SCREEN TOOL", "Use Capture screen to open the browser’s permission prompt. Nothing is shared until you choose a screen or window.");
    setActive(false);
    return;
  }
  const timerRequest = parseTimerRequest(text);
  if (timerRequest) {
    if (timerRequest.cancelAll) {
      const cancelledCount = timers.length;
      timers = [];
      saveTimers();
      renderTimers();
      const reply = cancelledCount ? `Cancelled ${cancelledCount} active timer${cancelledCount === 1 ? "" : "s"}.` : "There are no active timers.";
      addToolCard("TIMERS", reply);
      speak(reply);
    } else if (timerRequest.error) {
      addToolCard("TIMER NOT SET", timerRequest.error);
      speak(timerRequest.error);
    } else {
      addTimer(timerRequest.label, timerRequest.duration);
    }
    setActive(false);
    return;
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: getConversationHistory() })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Assistant request failed (HTTP ${response.status}).`);
    }
    const reply = data.reply || getReply(text);
    addMessage(reply, "assistant");
    if (data.warning) addMessage(data.warning, "assistant");
    speak(reply);
    setActive(false);
  } catch (error) {
    const fallback = getReply(text);
    addMessage(fallback, "assistant");
    addMessage(`Assistant connection failed; using local commands instead. ${error.message}`, "assistant");
    speak(fallback);
    setActive(false);
  }
}

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  document.getElementById("top-clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  document.getElementById("date").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
  input.focus();
});

document.getElementById("clear-button").addEventListener("click", () => {
  clearConversation();
  addMessage("Conversation cleared. Ready when you are.", "assistant");
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => sendMessage(button.dataset.command));
});

async function runTool(task) {
  setActive(true);
  try {
    await task();
  } finally {
    setActive(false);
  }
}

document.getElementById("weather-button").addEventListener("click", () => runTool(showWeather));
document.getElementById("news-button").addEventListener("click", () => runTool(showHeadlines));
document.getElementById("file-button").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => runTool(() => scanSelectedFile(fileInput.files[0])));
document.getElementById("screen-button").addEventListener("click", () => runTool(captureScreen));
document.getElementById("copy-button").addEventListener("click", async () => {
  const replies = chat.querySelectorAll(".message-assistant:not(.tool-message) .message-body");
  const lastReply = replies[replies.length - 1]?.textContent;
  if (!lastReply) {
    toolStatus.textContent = "There is no assistant reply to copy yet.";
    return;
  }
  try {
    await navigator.clipboard.writeText(lastReply);
    toolStatus.textContent = "Copied the latest JARVIS reply to your clipboard.";
  } catch (error) {
    toolStatus.textContent = `Clipboard access is unavailable. Select and copy the reply manually. ${error.message}`;
  }
});
document.getElementById("notification-button").addEventListener("click", () => enableNotifications());
voiceSelect.addEventListener("change", () => {
  try {
    localStorage.setItem(speechVoiceKey, voiceSelect.value);
  } catch {
    toolStatus.textContent = "Voice changed for this session; browser storage is unavailable.";
  }
  const voice = window.speechSynthesis.getVoices()
    .find((item) => isVoiceFour(item) && item.name === voiceSelect.value);
  toolStatus.textContent = voice
    ? `Using Google English voice: ${voice.name} (${voice.lang}).`
    : "Google US English voice 4 is unavailable; speech output is disabled.";
});
document.getElementById("voice-test-button").addEventListener("click", () => {
  const voice = window.speechSynthesis.getVoices()
    .find((item) => isVoiceFour(item) && item.name === voiceSelect.value);
  if (!voice) {
    toolStatus.textContent = "Google US English voice 4 is unavailable in this browser.";
    return;
  }
  toolStatus.textContent = `Previewing Google English voice: ${voice.name} (${voice.lang}).`;
  speak("Good day. Systems are online. How may I assist you?");
});
voiceModeEnter.addEventListener("click", enterVoiceOnlyMode);
voiceModeExit.addEventListener("click", exitVoiceOnlyMode);
document.addEventListener("fullscreenchange", () => {
  if (voiceOnlyMode && document.fullscreenElement !== appShell) exitVoiceOnlyMode();
});
if ("speechSynthesis" in window) {
  populateSpeechVoices();
  window.speechSynthesis.addEventListener("voiceschanged", populateSpeechVoices);
}
renderTimers();
checkTimers();
setInterval(checkTimers, 1000);

voiceButton.addEventListener("click", () => startVoiceRecognition());

voiceStatus.textContent = speechSupported ? "VOICE INPUT AVAILABLE" : "VOICE INPUT NOT SUPPORTED";
restoreMessages();
updateClock();
setInterval(updateClock, 1000);
