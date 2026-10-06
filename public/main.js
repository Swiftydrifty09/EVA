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
const cpuUsage = document.getElementById("cpu-usage");
const cpuDevice = document.getElementById("cpu-device");
const cpuBar = document.getElementById("cpu-bar");
const gpuMetrics = document.getElementById("gpu-metrics");
const resourceUpdated = document.getElementById("resource-updated");
const networkStatus = document.getElementById("network-status");
const speechSupported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
const timerStorageKey = "jarvis-timers";
const speechVoiceKey = "jarvis-speech-voice";
const localDataStorageKey = "jarvis-local-data";
const profilesStorageKey = "jarvis-profiles";
const activeProfileStorageKey = "jarvis-active-profile";
const localPreferencesKey = "jarvis-local-preferences";
const commandAliasesKey = "jarvis-command-aliases";
const sessionStartedAt = Date.now();
let sessionCommandCount = 0;
let stopwatchStartedAt = 0;
let stopwatchElapsed = 0;
let stopwatchInterval;
let localPreferences = loadLocalPreferences();
let commandAliases = loadCommandAliases();
const isGoogleUkMaleVoice = (voice) =>
  /\bgoogle\b/i.test(voice.name) && /\bmale\b/i.test(voice.name) && /^en[-_]gb$/i.test(voice.lang);
const pickPreferredVoice = (voices) =>
  voices.find(isGoogleUkMaleVoice) ||
  voices.find((voice) => /^Google UK English Male/i.test(voice.name)) ||
  voices.find((voice) => /^en[-_]gb$/i.test(voice.lang)) ||
  voices[0];
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
let isUpdatingSystemMetrics = false;
const profileState = loadProfiles();
let profiles = profileState.profiles;
let activeProfileId = profileState.activeProfileId;
let localData = profiles.find((profile) => profile.id === activeProfileId);

function loadLocalPreferences() {
  const defaults = {
    speechRate: 1.1,
    speechPitch: 1,
    speechMuted: false,
    theme: "blue",
    personality: "balanced"
  };
  try {
    const saved = JSON.parse(localStorage.getItem(localPreferencesKey) || "null");
    return {
      speechRate: Number.isFinite(saved?.speechRate) ? Math.min(1.6, Math.max(0.7, saved.speechRate)) : defaults.speechRate,
      speechPitch: Number.isFinite(saved?.speechPitch) ? Math.min(1.5, Math.max(0.5, saved.speechPitch)) : defaults.speechPitch,
      speechMuted: typeof saved?.speechMuted === "boolean" ? saved.speechMuted : defaults.speechMuted,
      theme: ["blue", "arctic", "violet", "amber"].includes(saved?.theme) ? saved.theme : defaults.theme,
      personality: ["balanced", "concise", "friendly", "formal"].includes(saved?.personality)
        ? saved.personality
        : defaults.personality
    };
  } catch {
    return defaults;
  }
}

function saveLocalPreferences() {
  try {
    localStorage.setItem(localPreferencesKey, JSON.stringify(localPreferences));
    return true;
  } catch (error) {
    toolStatus.textContent = `Voice settings could not be saved: ${error.message}`;
    return false;
  }
}

function applyAppearancePreferences() {
  appShell.dataset.theme = localPreferences.theme;
  document.getElementById("theme-select").value = localPreferences.theme;
  document.getElementById("personality-select").value = localPreferences.personality;
}

function updateNetworkStatus() {
  const online = navigator.onLine;
  networkStatus.textContent = online ? "NETWORK ONLINE" : "OFFLINE · LOCAL TOOLS";
  networkStatus.title = online
    ? "The browser reports a network connection. Online tools still require internet access."
    : "Offline. Local tools remain available.";
  networkStatus.classList.toggle("is-offline", !online);
}

let microphoneStream;
let microphoneContext;
let microphoneFrame;
let microphoneRequestId = 0;

function stopMicrophoneReactivity() {
  microphoneRequestId += 1;
  if (microphoneFrame) cancelAnimationFrame(microphoneFrame);
  microphoneFrame = 0;
  microphoneStream?.getTracks().forEach((track) => track.stop());
  microphoneStream = null;
  if (microphoneContext && microphoneContext.state !== "closed") {
    microphoneContext.close().catch((error) => {
      toolStatus.textContent = `Microphone visualizer cleanup failed: ${error.message}`;
    });
  }
  microphoneContext = null;
  coreVisual.classList.remove("is-mic-reactive");
  coreVisual.style.removeProperty("--voice-brightness");
  coreVisual.style.removeProperty("--voice-glow");
}

async function startMicrophoneReactivity() {
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!navigator.mediaDevices?.getUserMedia || !AudioContextType) {
    document.getElementById("mic-reactive-toggle").checked = false;
    toolStatus.textContent = "Microphone-reactive visuals need microphone access and Web Audio support in this browser.";
    return;
  }
  stopMicrophoneReactivity();
  const requestId = microphoneRequestId;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (requestId !== microphoneRequestId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    microphoneStream = stream;
    microphoneContext = new AudioContextType();
    const source = microphoneContext.createMediaStreamSource(microphoneStream);
    const analyser = microphoneContext.createAnalyser();
    analyser.fftSize = 512;
    const samples = new Float32Array(analyser.fftSize);
    source.connect(analyser);
    coreVisual.classList.add("is-mic-reactive");
    toolStatus.textContent = "Microphone visualizer active. Audio is analyzed in this tab and is not recorded or sent.";

    const updateLevel = () => {
      if (!microphoneStream || !microphoneContext) return;
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
      const level = Math.min(1, rms * 8);
      coreVisual.style.setProperty("--voice-brightness", (1 + level * 0.8).toFixed(2));
      coreVisual.style.setProperty("--voice-glow", level.toFixed(2));
      microphoneFrame = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  } catch (error) {
    if (requestId !== microphoneRequestId) return;
    stopMicrophoneReactivity();
    document.getElementById("mic-reactive-toggle").checked = false;
    toolStatus.textContent = `Microphone visualizer unavailable: ${error.message}`;
  }
}

function loadCommandAliases() {
  try {
    const saved = JSON.parse(localStorage.getItem(commandAliasesKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((alias) =>
      alias && typeof alias.phrase === "string" && typeof alias.command === "string"
    ).slice(0, 30);
  } catch {
    return [];
  }
}

function saveCommandAliases() {
  try {
    localStorage.setItem(commandAliasesKey, JSON.stringify(commandAliases));
    return true;
  } catch (error) {
    toolStatus.textContent = `Command aliases could not be saved: ${error.message}`;
    return false;
  }
}

function normalizeProfile(stored, fallbackId) {
  if (!stored || typeof stored !== "object") return null;
  return {
    id: typeof stored.id === "string" && stored.id ? stored.id : fallbackId,
    profile: {
      name: typeof stored.profile?.name === "string" ? stored.profile.name.slice(0, 80) : ""
    },
    voiceName: typeof stored.voiceName === "string" ? stored.voiceName : "",
    facts: Array.isArray(stored.facts)
      ? stored.facts.filter((fact) => typeof fact === "string").slice(-100)
      : [],
    tasks: Array.isArray(stored.tasks)
      ? stored.tasks.filter((task) =>
          task && typeof task.id === "string" && typeof task.title === "string" &&
          Number.isFinite(task.createdAt) &&
          (task.dueAt == null || (typeof task.dueAt === "number" && Number.isFinite(task.dueAt))) &&
          ["open", "done"].includes(task.status)
        ).slice(-100)
      : [],
    notes: Array.isArray(stored.notes)
      ? stored.notes.filter((note) =>
          note && typeof note.id === "string" && typeof note.title === "string" &&
          typeof note.content === "string" && Number.isFinite(note.createdAt)
        ).slice(-100)
      : []
  };
}

function loadProfiles() {
  try {
    const savedProfiles = JSON.parse(localStorage.getItem(profilesStorageKey) || "null");
    if (Array.isArray(savedProfiles)) {
      const seen = new Set();
      const profiles = savedProfiles
        .map((profile, index) => normalizeProfile(profile, `profile-${index + 1}`))
        .filter((profile) => profile && !seen.has(profile.id) && seen.add(profile.id));
      if (profiles.length) {
        const savedActiveId = localStorage.getItem(activeProfileStorageKey);
        return {
          profiles,
          activeProfileId: profiles.some((profile) => profile.id === savedActiveId)
            ? savedActiveId
            : profiles[0].id
        };
      }
    }
  } catch {
    // Use the previous single-profile data format when profile storage is absent or invalid.
  }

  let legacyData = null;
  let legacyVoice = "";
  try {
    legacyData = JSON.parse(localStorage.getItem(localDataStorageKey) || "null");
    legacyVoice = localStorage.getItem(speechVoiceKey) || "";
  } catch {
    // A fresh in-memory profile is still usable when browser storage is unavailable.
  }
  const migrated = normalizeProfile({
    ...legacyData,
    voiceName: legacyVoice
  }, "default");
  const defaultProfile = migrated || normalizeProfile({}, "default");
  return { profiles: [defaultProfile], activeProfileId: defaultProfile.id };
}

function saveLocalData() {
  try {
    localStorage.setItem(profilesStorageKey, JSON.stringify(profiles));
    localStorage.setItem(activeProfileStorageKey, activeProfileId);
    updateMemorySummary();
    return true;
  } catch (error) {
    toolStatus.textContent = `This change is available only until the page closes because browser storage failed: ${error.message}`;
    updateMemorySummary();
    return false;
  }
}

function updateMemorySummary() {
  const summary = document.getElementById("memory-summary");
  if (summary) {
    const items = localData.facts.length + localData.tasks.length + localData.notes.length;
    const name = localData.profile.name || "Unnamed profile";
    summary.textContent = `${items} saved item${items === 1 ? "" : "s"} for ${name} · stored only in this browser`;
  }
}

function createLocalId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderProfiles() {
  const profileSelect = document.getElementById("profile-select");
  profileSelect.replaceChildren();
  profiles.forEach((profile) => {
    const name = profile.profile.name || "Unnamed profile";
    profileSelect.add(new Option(name, profile.id));
  });
  profileSelect.value = activeProfileId;
  document.getElementById("profile-name").value = localData.profile.name;
  updateMemorySummary();
}

function setActiveProfile(profileId) {
  const selectedProfile = profiles.find((profile) => profile.id === profileId);
  if (!selectedProfile) return;
  localData = selectedProfile;
  activeProfileId = profileId;
  renderProfiles();
  let saved = false;
  try {
    localStorage.setItem(activeProfileStorageKey, activeProfileId);
    saved = true;
  } catch {
    // The selected profile remains active until this page closes.
  }
  if ("speechSynthesis" in window) populateSpeechVoices();
  toolStatus.textContent = saved
    ? `Switched to ${localData.profile.name || "Unnamed profile"}; its saved items and spoken voice are active.`
    : "Profile switched for this session, but browser storage is unavailable.";
}

function syncProfilesAcrossTabs(event) {
  if (event.key !== null && event.key !== profilesStorageKey && event.key !== activeProfileStorageKey) return;

  const profileState = loadProfiles();
  profiles = profileState.profiles;
  activeProfileId = profileState.activeProfileId;
  localData = profiles.find((profile) => profile.id === activeProfileId);
  renderProfiles();
  if ("speechSynthesis" in window) populateSpeechVoices();
  toolStatus.textContent = `Profiles synced from another tab. Active profile: ${localData.profile.name || "Unnamed profile"}.`;
}

function addProfile(name) {
  const normalizedName = name.trim().slice(0, 80);
  if (!normalizedName) {
    toolStatus.textContent = "Enter a name before adding a profile.";
    return;
  }
  const existing = profiles.find((profile) =>
    profile.profile.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  );
  if (existing) {
    setActiveProfile(existing.id);
    toolStatus.textContent = `A profile named ${normalizedName} already exists; switched to it.`;
    return;
  }
  const profile = normalizeProfile({
    id: createLocalId(),
    profile: { name: normalizedName }
  }, createLocalId());
  profiles.push(profile);
  localData = profile;
  activeProfileId = profile.id;
  renderProfiles();
  const saved = saveLocalData();
  toolStatus.textContent = saved
    ? `Added profile ${normalizedName}. Choose its spoken voice below.`
    : `Added ${normalizedName} for this session, but browser storage is unavailable.`;
  if ("speechSynthesis" in window) populateSpeechVoices();
}

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
    addMessage("Good day. Local systems are ready. Ask for a local briefing, the time, a unit conversion, or a timer; weather and headlines are available online, and Agent Tools has file and screen utilities.", "assistant");
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
  if (/\b(help|commands|what can you do)\b/.test(normalized)) return "Try: 'Brief me' for your local tasks and timers, 'What did I save about the trip?' to search local notes and memories, 'Remind me tomorrow to call Sam', 'What time is it?', 'Convert 5 miles to km', 'Set a timer for 5 minutes', 'Remember that I prefer concise answers', 'Create a task: review the release', 'List tasks', or 'Save a note: launch checklist'. Say 'repeat that' to hear the last reply again; in full-screen voice mode, say 'stop listening' to exit.";
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

  return "I am running without an AI service, so I cannot answer open-ended questions yet. I can brief you on your local tasks and timers, search saved notes and memories, set local task reminders, tell the time or date, calculate expressions, manage saved tasks and notes, tell a joke, and open or search the web. Say 'help' for examples.";
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
  const placeTimeRequest = /^(?:(?:what(?:'s| is)? )?(?:the )?time(?: is it)?|tell me (?:the )?time|current time|local time|clock)\s+(?:in|at|for)\s+(.+?)[?.!]*$/;
  const timeZoneAliases = {
    "new york": "America/New_York", "nyc": "America/New_York",
    "washington dc": "America/New_York", "toronto": "America/Toronto",
    "chicago": "America/Chicago", "dallas": "America/Chicago", "mexico city": "America/Mexico_City",
    "denver": "America/Denver", "phoenix": "America/Phoenix",
    "los angeles": "America/Los_Angeles", "la": "America/Los_Angeles",
    "san francisco": "America/Los_Angeles", "seattle": "America/Los_Angeles",
    "anchorage": "America/Anchorage", "honolulu": "Pacific/Honolulu",
    "vancouver": "America/Vancouver", "sao paulo": "America/Sao_Paulo",
    "rio de janeiro": "America/Sao_Paulo", "buenos aires": "America/Argentina/Buenos_Aires",
    "london": "Europe/London", "dublin": "Europe/Dublin", "lisbon": "Europe/Lisbon",
    "paris": "Europe/Paris", "madrid": "Europe/Madrid", "barcelona": "Europe/Madrid",
    "rome": "Europe/Rome", "berlin": "Europe/Berlin", "amsterdam": "Europe/Amsterdam",
    "brussels": "Europe/Brussels", "zurich": "Europe/Zurich", "geneva": "Europe/Zurich",
    "vienna": "Europe/Vienna", "prague": "Europe/Prague", "warsaw": "Europe/Warsaw",
    "athens": "Europe/Athens", "helsinki": "Europe/Helsinki", "stockholm": "Europe/Stockholm",
    "oslo": "Europe/Oslo", "copenhagen": "Europe/Copenhagen", "istanbul": "Europe/Istanbul",
    "moscow": "Europe/Moscow", "cairo": "Africa/Cairo", "johannesburg": "Africa/Johannesburg",
    "lagos": "Africa/Lagos", "nairobi": "Africa/Nairobi", "dubai": "Asia/Dubai",
    "jerusalem": "Asia/Jerusalem", "delhi": "Asia/Kolkata", "mumbai": "Asia/Kolkata",
    "kolkata": "Asia/Kolkata", "bangkok": "Asia/Bangkok", "jakarta": "Asia/Jakarta",
    "singapore": "Asia/Singapore", "hong kong": "Asia/Hong_Kong", "shanghai": "Asia/Shanghai",
    "beijing": "Asia/Shanghai", "china": "Asia/Shanghai", "taipei": "Asia/Taipei",
    "seoul": "Asia/Seoul", "south korea": "Asia/Seoul", "japan": "Asia/Tokyo",
    "india": "Asia/Kolkata", "uae": "Asia/Dubai", "united arab emirates": "Asia/Dubai",
    "tokyo": "Asia/Tokyo", "osaka": "Asia/Tokyo", "sydney": "Australia/Sydney",
    "melbourne": "Australia/Melbourne", "brisbane": "Australia/Brisbane",
    "perth": "Australia/Perth", "auckland": "Pacific/Auckland", "wellington": "Pacific/Auckland"
  };
  const dateRequest = /^(?:(?:what(?:'s| is) )?(?:the )?date(?: is it)?|tell me (?:the )?date|today(?:'s)? date|what day is it)(?: please)?[?.!]*$/;

  const placeTime = normalized.match(placeTimeRequest);
  if (placeTime) {
    const place = placeTime[1].trim().replace(/\s+/g, " ");
    const zone = timeZoneAliases[place] || place.replace(/\s/g, "_");
    try {
      const formatter = new Intl.DateTimeFormat([], {
        timeZone: zone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "long"
      });
      return `The time in ${place} is ${formatter.format(new Date())}.`;
    } catch {
      return `I couldn’t identify “${place}” as a city I recognize or an IANA time zone. Try a major city such as Tokyo or New York, or a zone like America/Argentina/Buenos_Aires.`;
    }
  }

  if (timeRequest.test(normalized)) {
    return `The local time is ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}.`;
  }
  if (dateRequest.test(normalized)) {
    return `Today is ${new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
  }
  return null;
}

function describeLocalSave(saved) {
  return saved ? "" : " It is only saved for this tab session because browser storage is unavailable.";
}

function addLocalListCard(title, entries, emptyText) {
  const card = addToolCard(title, "");
  if (!entries.length) {
    card.querySelector(".message-body").textContent = emptyText;
    return;
  }
  const list = document.createElement("ul");
  list.className = "local-item-list";
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    list.append(item);
  });
  card.append(list);
}

function createLocalBriefing() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).getTime();
  const openTasks = localData.tasks.filter((task) => task.status === "open");
  const overdueTasks = openTasks
    .filter((task) => task.dueAt != null && task.dueAt < startOfToday)
    .sort((a, b) => a.dueAt - b.dueAt);
  const dueToday = openTasks
    .filter((task) => task.dueAt != null && task.dueAt >= startOfToday && task.dueAt < endOfToday)
    .sort((a, b) => a.dueAt - b.dueAt);
  const dueSoon = openTasks
    .filter((task) => task.dueAt != null && task.dueAt >= endOfToday && task.dueAt < endOfWeek)
    .sort((a, b) => a.dueAt - b.dueAt);
  const undatedTasks = openTasks.filter((task) => task.dueAt == null);
  const activeTimers = timers
    .filter((timer) => timer.dueAt > now.getTime())
    .sort((a, b) => a.dueAt - b.dueAt);

  const taskEntry = (task) => {
    const due = new Date(task.dueAt).toLocaleDateString([], { month: "short", day: "numeric" });
    return `${task.title} · due ${due}`;
  };
  const entries = [
    `Local time: ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`,
    `Open tasks: ${openTasks.length} · overdue: ${overdueTasks.length} · due today: ${dueToday.length}.`
  ];

  if (overdueTasks.length) {
    entries.push("Overdue — consider reviewing these first:", ...overdueTasks.slice(0, 5).map(taskEntry));
  }
  if (dueToday.length) {
    entries.push("Due today:", ...dueToday.slice(0, 5).map(taskEntry));
  }
  if (dueSoon.length) {
    entries.push("Due in the next 6 days:", ...dueSoon.slice(0, 5).map(taskEntry));
  }
  if (undatedTasks.length) {
    entries.push("Open tasks with no due date:", ...undatedTasks.slice(0, 5).map((task) => task.title));
    if (undatedTasks.length > 5) entries.push(`${undatedTasks.length - 5} more undated task${undatedTasks.length === 6 ? "" : "s"}.`);
  }
  if (activeTimers.length) {
    entries.push("Next active timers:", ...activeTimers.slice(0, 3).map((timer) =>
      `${timer.label} · ${formatDuration(timer.dueAt - now.getTime())} remaining`
    ));
  } else {
    entries.push("No active timers.");
  }
  entries.push(`Saved locally: ${localData.facts.length} memor${localData.facts.length === 1 ? "y" : "ies"} and ${localData.notes.length} note${localData.notes.length === 1 ? "" : "s"}.`);
  addLocalListCard("LOCAL DAILY BRIEFING", entries, "No local briefing data is available.");
  return overdueTasks.length || dueToday.length
    ? `Your local briefing: ${overdueTasks.length} overdue and ${dueToday.length} due today. I’ve listed your tasks and active timers.`
    : `Your local briefing is ready. You have ${openTasks.length} open tasks and ${activeTimers.length} active timers.`;
}

function searchLocalInformation(query) {
  const ignoredWords = new Set("about anything find for have i me my of saved search show the what".split(" "));
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [];
  const terms = [...new Set(words.filter((word) => word.length > 1 && !ignoredWords.has(word)))];
  if (!terms.length) return "Add a few specific words to search your saved information.";

  const records = [
    ...localData.facts.map((fact) => ({ type: "MEMORY", title: fact, content: fact })),
    ...localData.notes.map((note) => ({ type: "NOTE", title: note.title, content: note.content })),
    ...localData.tasks.map((task) => ({
      type: task.status === "open" ? "OPEN TASK" : "COMPLETED TASK",
      title: task.title,
      content: task.title
    }))
  ];
  const matches = records
    .map((record) => {
      const haystack = `${record.title} ${record.content}`.toLocaleLowerCase();
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const exactPhraseBonus = haystack.includes(query.toLocaleLowerCase().trim()) ? terms.length : 0;
      return { ...record, score: matchedTerms.length + exactPhraseBonus };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!matches.length) {
    return `I couldn’t find saved notes, memories, or tasks matching “${query}”.`;
  }

  const entries = matches.slice(0, 8).map((record) => {
    const excerpt = record.content.length > 200 ? `${record.content.slice(0, 197)}…` : record.content;
    return `${record.type} · ${record.title === excerpt ? record.title : `${record.title}: ${excerpt}`}`;
  });
  addLocalListCard("LOCAL SEARCH RESULTS", entries, "No saved information matched.");
  return `I found ${matches.length} saved item${matches.length === 1 ? "" : "s"} matching “${query}”. The results were searched only in this browser.`;
}

function saveLocalTask(title, dueAt) {
  const task = { id: createLocalId(), title, createdAt: Date.now(), dueAt, status: "open" };
  localData.tasks.push(task);
  localData.tasks = localData.tasks.slice(-100);
  const saved = saveLocalData();
  return `Task added: ${title}${dueAt ? `, due ${new Date(dueAt).toLocaleDateString()}` : ""}.${describeLocalSave(saved)}`;
}

function parseTaskDueDate(dayText, daysFromNow) {
  const date = new Date();
  if (Number.isInteger(daysFromNow)) {
    if (daysFromNow < 0 || daysFromNow > 365) return null;
    date.setDate(date.getDate() + daysFromNow);
  } else if (dayText?.toLocaleLowerCase() === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function convertMeasurement(message) {
  const match = message.trim().replace(/[?.!]+$/, "").match(
    /^convert\s+(-?\d+(?:\.\d+)?)\s+(?:from\s+)?([a-z]+)\s+to\s+([a-z]+)$/i
  );
  if (!match) return null;

  const units = {
    m: ["length", "m", 1], meter: ["length", "m", 1], meters: ["length", "m", 1],
    km: ["length", "km", 1000], kilometer: ["length", "km", 1000], kilometers: ["length", "km", 1000],
    mi: ["length", "mi", 1609.344], mile: ["length", "mi", 1609.344], miles: ["length", "mi", 1609.344],
    ft: ["length", "ft", 0.3048], foot: ["length", "ft", 0.3048], feet: ["length", "ft", 0.3048],
    in: ["length", "in", 0.0254], inch: ["length", "in", 0.0254], inches: ["length", "in", 0.0254],
    kg: ["mass", "kg", 1], kilogram: ["mass", "kg", 1], kilograms: ["mass", "kg", 1],
    g: ["mass", "g", 0.001], gram: ["mass", "g", 0.001], grams: ["mass", "g", 0.001],
    lb: ["mass", "lb", 0.45359237], lbs: ["mass", "lb", 0.45359237], pound: ["mass", "lb", 0.45359237], pounds: ["mass", "lb", 0.45359237],
    oz: ["mass", "oz", 0.028349523125], ounce: ["mass", "oz", 0.028349523125], ounces: ["mass", "oz", 0.028349523125],
    l: ["volume", "L", 1], liter: ["volume", "L", 1], liters: ["volume", "L", 1], litre: ["volume", "L", 1], litres: ["volume", "L", 1],
    ml: ["volume", "mL", 0.001], milliliter: ["volume", "mL", 0.001], milliliters: ["volume", "mL", 0.001],
    gal: ["volume", "US gal", 3.785411784], gallon: ["volume", "US gal", 3.785411784], gallons: ["volume", "US gal", 3.785411784],
    c: ["temperature", "°C"], celsius: ["temperature", "°C"],
    f: ["temperature", "°F"], fahrenheit: ["temperature", "°F"]
  };
  const [, rawValue, sourceName, targetName] = match;
  const source = units[sourceName.toLocaleLowerCase()];
  const target = units[targetName.toLocaleLowerCase()];
  if (!source || !target) {
    return "I don’t recognize one of those units. Try length (miles, km, feet), mass (lb, kg, oz), volume (gallons, liters), or temperature (Fahrenheit, Celsius).";
  }
  if (source[0] !== target[0]) {
    return "Those units measure different things. Choose two length, mass, volume, or temperature units.";
  }

  const value = Number(rawValue);
  let converted;
  if (source[0] === "temperature") {
    const celsius = source[1] === "°F" ? (value - 32) * 5 / 9 : value;
    converted = target[1] === "°F" ? celsius * 9 / 5 + 32 : celsius;
  } else {
    converted = value * source[2] / target[2];
  }
  if (!Number.isFinite(converted)) return "That value is too large to convert.";

  const formatted = Number(converted.toPrecision(6)).toLocaleString(undefined, { maximumSignificantDigits: 6 });
  return `${rawValue} ${source[1]} = ${formatted} ${target[1]}.`;
}

function runLocalCommand(message) {
  const text = message.trim().replace(/[?.!]+$/, "");
  const normalized = text.toLocaleLowerCase();

  if (/^(?:help|commands|what can you do|show commands)$/.test(normalized)) {
    return "I can help locally with time and date, calculations, unit conversions, random numbers, timers, stopwatch, saved memories, tasks, notes, and system diagnostics. Weather, headlines, maps, and web searches need an internet connection.";
  }

  if (/^(?:give me |pick )?(?:a )?random(?: number)?(?: between| from) /i.test(text) ||
      /^(?:give me )?a? ?random number$/i.test(text)) {
    const range = text.match(/(?:between|from)\s+(-?\d+)\s+(?:and|to)\s+(-?\d+)$/i);
    const minimum = range ? Number(range[1]) : 1;
    const maximum = range ? Number(range[2]) : 100;
    if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || maximum < minimum) {
      return "Give me a valid whole-number range, such as “random number between 1 and 100.”";
    }
    const span = maximum - minimum + 1;
    if (!Number.isSafeInteger(span) || span < 1 || span > 1_000_000_000) {
      return "Please choose a random-number range with at most one billion possible values.";
    }
    const cryptoSource = window.crypto;
    if (!cryptoSource?.getRandomValues) {
      return "Secure random number generation is unavailable in this browser.";
    }
    const sample = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / span) * span;
    do {
      cryptoSource.getRandomValues(sample);
    } while (sample[0] >= limit);
    return `Your random number is ${minimum + sample[0] % span}.`;
  }

  const conversion = convertMeasurement(text);
  if (conversion) return conversion;

  if (/^(?:brief me|daily briefing|give me (?:a )?briefing|what should i focus on(?: today)?|what(?:'s| is) on my plate|what needs doing today)(?: please)?$/.test(normalized)) {
    return createLocalBriefing();
  }

  const reminder = text.match(
    /^remind me (?:to (.+?) (today|tomorrow)|in (\d{1,3}) days? to (.+)|(today|tomorrow) to (.+))$/i
  );
  if (reminder) {
    const title = (reminder[1] || reminder[4] || reminder[6]).trim().slice(0, 200);
    const daysFromNow = reminder[3] === undefined ? undefined : Number(reminder[3]);
    const dueAt = parseTaskDueDate(reminder[2] || reminder[5], daysFromNow);
    if (dueAt === null) return "Choose a reminder from today up to 365 days from now.";
    if (!title) return "Tell me what you would like to be reminded about.";
    const reply = saveLocalTask(title, dueAt);
    return `${reply} This is a local task reminder, not a timed notification.`;
  }

  const searchSaved = text.match(
    /^(?:search (?:my )?(?:notes|memories|saved info) for|find (?:saved )?(?:notes?|memories|info) (?:about|for)|what did i (?:save|write|note) (?:about|regarding)|what do i have saved (?:about|regarding)|do i have anything saved? (?:about|regarding))\s+(.+)$/i
  );
  if (searchSaved) return searchLocalInformation(searchSaved[1]);

  const setName = text.match(/^(?:my name is|call me)\s+(.+)$/i);
  if (setName) {
    const name = setName[1].trim().replace(/^["']|["']$/g, "").slice(0, 80);
    if (!name) return "Tell me what name you would like me to remember.";
    localData.profile.name = name;
    const saved = saveLocalData();
    renderProfiles();
    return `Got it${describeLocalSave(saved)} I’ll call you ${name}.`;
  }

  const remember = text.match(/^(?:remember(?: that)?|save that)\s+(.+)$/i);
  if (remember) {
    const fact = remember[1].trim().replace(/^["']|["']$/g, "").slice(0, 300);
    const nameFact = fact.match(/^my name is\s+(.+)$/i);
    if (nameFact) {
      localData.profile.name = nameFact[1].trim().slice(0, 80);
      const saved = saveLocalData();
      renderProfiles();
      return `I’ll remember your name is ${localData.profile.name}.${describeLocalSave(saved)}`;
    }
    if (!fact) return "Tell me what you would like me to remember.";
    if (!localData.facts.some((entry) => entry.toLocaleLowerCase() === fact.toLocaleLowerCase())) {
      localData.facts.push(fact);
      localData.facts = localData.facts.slice(-100);
    }
    const saved = saveLocalData();
    return `I’ll remember: ${fact}.${describeLocalSave(saved)}`;
  }

  if (/^(?:what do you know about me|what do you remember|show my profile|my profile)$/.test(normalized)) {
    const details = [
      localData.profile.name ? `Your name is ${localData.profile.name}` : "",
      ...localData.facts
    ].filter(Boolean);
    return details.length ? `Here’s what I have saved locally: ${details.join("; ")}.` : "I don’t have any profile details or facts saved yet.";
  }

  const forget = text.match(/^(?:forget|remove (?:fact|memory)) (?:that )?(.+)$/i);
  if (forget) {
    const query = forget[1].trim().toLocaleLowerCase();
    const previousCount = localData.facts.length;
    localData.facts = localData.facts.filter((fact) => !fact.toLocaleLowerCase().includes(query));
    let removed = previousCount !== localData.facts.length;
    if (localData.profile.name && (["my name", "name"].includes(query) || localData.profile.name.toLocaleLowerCase().includes(query))) {
      localData.profile.name = "";
      renderProfiles();
      removed = true;
    }
    if (!removed) return `I couldn’t find a saved fact matching “${forget[1]}”.`;
    const saved = saveLocalData();
    return `Forgot the matching saved detail.${describeLocalSave(saved)}`;
  }

  const addTask = text.match(/^(?:create|add|make)\s+(?:a\s+)?task(?:\s+(?:called|to)\s+|:\s*|\s+)(.+)$/i);
  if (addTask) {
    let title = addTask[1].trim();
    let dueAt = null;
    const due = title.match(/\s+(?:for|due|by)\s+(today|tomorrow)$/i);
    if (due) {
      const dueDate = new Date();
      if (due[1].toLowerCase() === "tomorrow") dueDate.setDate(dueDate.getDate() + 1);
      dueDate.setHours(23, 59, 59, 999);
      dueAt = dueDate.getTime();
      title = title.slice(0, due.index).trim();
    }
    title = title.replace(/^["']|["']$/g, "").slice(0, 200);
    if (!title) return "Give the task a short description, for example: “Create a task: review the release”.";
    return saveLocalTask(title, dueAt);
  }

  if (/^(?:(?:list|show) (?:my )?|what(?:'s| is| are) (?:on )?(?:my )?)(?:tasks|to-?dos)$/.test(normalized)) {
    const openTasks = localData.tasks.filter((task) => task.status === "open");
    addLocalListCard("YOUR TASKS", openTasks.map((task, index) => {
      const due = task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : "";
      return `${index + 1}. ${task.title}${due}`;
    }), "You have no open tasks. Try “Create a task: …”.");
    return openTasks.length ? `You have ${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}.` : "You have no open tasks.";
  }

  const completeTask = text.match(/^(?:complete|finish|mark)\s+(?:task\s+)?(.+?)(?:\s+done)?$/i);
  if (completeTask && /^(?:complete|finish|mark)\b/i.test(text)) {
    const query = completeTask[1].trim().replace(/^#/, "");
    const openTasks = localData.tasks.filter((task) => task.status === "open");
    const taskIndex = /^\d+$/.test(query) ? Number(query) - 1 : -1;
    const matches = taskIndex >= 0
      ? [openTasks[taskIndex]].filter(Boolean)
      : openTasks.filter((task) => task.title.toLocaleLowerCase() === query.toLocaleLowerCase());
    if (matches.length !== 1) {
      return matches.length > 1
        ? "More than one task matches. Please use its number from “list tasks”."
        : `I couldn’t find an open task matching “${query}”. Use “list tasks” to see task numbers.`;
    }
    matches[0].status = "done";
    const saved = saveLocalData();
    return `Completed: ${matches[0].title}.${describeLocalSave(saved)}`;
  }

  const removeTask = text.match(/^(?:delete|remove|cancel)\s+(?:task\s+)?(.+)$/i);
  if (removeTask) {
    const query = removeTask[1].trim().replace(/^#/, "");
    const openTasks = localData.tasks.filter((task) => task.status === "open");
    const taskIndex = /^\d+$/.test(query) ? Number(query) - 1 : -1;
    const target = taskIndex >= 0
      ? openTasks[taskIndex]
      : openTasks.find((task) => task.title.toLocaleLowerCase() === query.toLocaleLowerCase());
    if (!target) return `I couldn’t find an open task matching “${query}”.`;
    localData.tasks = localData.tasks.filter((task) => task.id !== target.id);
    const saved = saveLocalData();
    return `Removed task: ${target.title}.${describeLocalSave(saved)}`;
  }

  const saveNote = text.match(/^(?:save|add|write)\s+(?:a\s+)?note(?:\s+(?:called|titled)\s+|:\s*|\s+)(.+)$/i);
  if (saveNote) {
    const content = saveNote[1].trim().replace(/^["']|["']$/g, "").slice(0, 2000);
    if (!content) return "Tell me what you would like in the note.";
    const note = {
      id: createLocalId(),
      title: content.split(/\r?\n/)[0].slice(0, 60),
      content,
      createdAt: Date.now()
    };
    localData.notes.push(note);
    localData.notes = localData.notes.slice(-100);
    const saved = saveLocalData();
    return `Saved a local note: ${note.title}.${describeLocalSave(saved)}`;
  }

  if (/^(?:(?:list|show|read) (?:my )?notes|what are my notes)$/.test(normalized)) {
    addLocalListCard("YOUR NOTES", localData.notes.slice().reverse().map((note, index) =>
      `${index + 1}. ${note.title} · ${new Date(note.createdAt).toLocaleDateString()}`
    ), "You have no saved notes. Try “Save a note: …”.");
    return localData.notes.length ? `You have ${localData.notes.length} saved note${localData.notes.length === 1 ? "" : "s"}.` : "You have no saved notes.";
  }

  const readLastNote = /^(?:read|show) (?:my )?(?:last|latest) note$/.test(normalized);
  if (readLastNote) {
    const note = localData.notes[localData.notes.length - 1];
    return note ? `Your latest note, ${note.title}: ${note.content}` : "You don’t have any saved notes yet.";
  }

  return null;
}

async function speak(text) {
  if (localPreferences.speechMuted) return;
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
  const voice = voices.find((item) => item.name === localData.voiceName) ||
    pickPreferredVoice(voices) ||
    voices[0];
  if (!voice) {
    speechPending = false;
    toolStatus.textContent = "No speech voices are available in this browser.";
    scheduleVoiceListening();
    return;
  }

  if (localData.voiceName !== voice.name) {
    localData.voiceName = voice.name;
    saveLocalData();
  }
  voiceSelect.value = voice.name;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = localPreferences.speechRate;
  utterance.pitch = localPreferences.speechPitch;
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

  const voices = window.speechSynthesis.getVoices();
  const preferredVoices = voices.filter((voice) =>
    /^Google UK English Male$/i.test(voice.name) && /^en[-_]gb$/i.test(voice.lang)
  );
  const selectableVoices = preferredVoices.length > 0 ? preferredVoices : voices;

  voiceSelect.replaceChildren();
  if (selectableVoices.length === 0) {
    voiceSelect.add(new Option("No browser voices available", ""));
    voiceSelect.disabled = true;
    toolStatus.textContent = "No speech voices are available in this browser.";
    return;
  }
  voiceSelect.disabled = false;
  selectableVoices.forEach((voice) => {
    voiceSelect.add(new Option(`${voice.name} (${voice.lang})`, voice.name));
  });
  if (!selectableVoices.some((voice) => voice.name === localData.voiceName)) {
    const defaultVoice = pickPreferredVoice(selectableVoices) || selectableVoices[0];
    localData.voiceName = defaultVoice.name;
    saveLocalData();
  }
  voiceSelect.value = localData.voiceName;
  const selected = selectableVoices.find((voice) => voice.name === localData.voiceName);
  if (selected) toolStatus.textContent = `Spoken voice for ${localData.profile.name || "this profile"}: ${selected.name}.`;
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
    if (!window.isSecureContext) {
      reject(new Error("Browser location needs a secure page. Open JARVIS with HTTPS or localhost."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser does not provide location access. You can still use Google Maps directly."));
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
      temperature_unit: "fahrenheit",
      wind_speed_unit: "mph",
      timezone: "auto"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`Weather feed returned HTTP ${response.status}.`);
    const data = await response.json();
    const current = data.current;
    if (!current || !Number.isFinite(current.temperature_2m)) {
      throw new Error("Weather feed did not return current conditions.");
    }

    const temperatureUnit = data.current_units?.temperature_2m || "°F";
    const windUnit = data.current_units?.wind_speed_10m || "mph";
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

function renderMap(frame, latitude, longitude, label, status, zoom = 12) {
  const minZoom = 3;
  const maxZoom = 18;
  const tileCount = 2 ** zoom;
  const normalizedLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const latitudeRadians = normalizedLatitude * Math.PI / 180;
  const tileX = (longitude + 180) / 360 * tileCount;
  const tileY = (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * tileCount;
  const viewport = document.createElement("div");
  viewport.className = "map-viewport";
  viewport.setAttribute("role", "img");
  viewport.setAttribute("aria-label", `Map showing ${label}`);

  const tileGrid = document.createElement("div");
  tileGrid.className = "map-tile-grid";

  const marker = document.createElement("span");
  marker.className = "map-marker";
  marker.setAttribute("aria-hidden", "true");
  viewport.append(tileGrid, marker);

  const zoomControls = document.createElement("div");
  zoomControls.className = "map-zoom-controls";
  zoomControls.setAttribute("role", "group");
  zoomControls.setAttribute("aria-label", "Map zoom controls");
  [
    { label: "Zoom in", symbol: "+", nextZoom: zoom + 1 },
    { label: "Zoom out", symbol: "−", nextZoom: zoom - 1 }
  ].forEach(({ label: controlLabel, symbol, nextZoom }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-zoom-button";
    button.textContent = symbol;
    button.setAttribute("aria-label", controlLabel);
    button.disabled = nextZoom < minZoom || nextZoom > maxZoom;
    button.addEventListener("click", () => {
      renderMap(frame, latitude, longitude, label, status, nextZoom);
      frame.querySelector(`[aria-label="${controlLabel}"]`)?.focus();
    });
    zoomControls.appendChild(button);
  });
  const canvas = document.createElement("div");
  canvas.className = "map-canvas";
  canvas.append(viewport, zoomControls);

  const externalLink = document.createElement("a");
  const externalUrl = new URL("https://www.google.com/maps/search/");
  externalUrl.search = new URLSearchParams({
    api: "1",
    query: `${latitude},${longitude}`
  });
  externalLink.href = externalUrl.toString();
  externalLink.target = "_blank";
  externalLink.rel = "noopener noreferrer";
  externalLink.textContent = "Open in Google Maps";

  const attribution = document.createElement("p");
  attribution.className = "map-attribution";
  attribution.textContent = "Map tiles © Esri, HERE, Garmin, FAO, NOAA, USGS and other providers.";

  frame.replaceChildren(canvas, attribution, externalLink);

  const renderTiles = () => {
    const tileSize = 256;
    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const firstColumn = Math.floor(tileX - viewportWidth / (2 * tileSize)) - 1;
    const lastColumn = Math.ceil(tileX + viewportWidth / (2 * tileSize)) + 1;
    const firstRow = Math.floor(tileY - viewportHeight / (2 * tileSize)) - 1;
    const lastRow = Math.ceil(tileY + viewportHeight / (2 * tileSize)) + 1;
    tileGrid.replaceChildren();

    for (let row = firstRow; row <= lastRow; row += 1) {
      for (let column = firstColumn; column <= lastColumn; column += 1) {
        const x = (column % tileCount + tileCount) % tileCount;
        const tile = document.createElement("img");
        tile.alt = "";
        tile.loading = "eager";
        tile.style.left = `${(column - tileX) * tileSize + viewportWidth / 2}px`;
        tile.style.top = `${(row - tileY) * tileSize + viewportHeight / 2}px`;
        tile.addEventListener("error", () => {
          status.textContent = "Some map tiles could not be loaded. Check your connection; you can still open this place in Google Maps.";
        }, { once: true });
        if (row >= 0 && row < tileCount) {
          tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${row}/${x}`;
        }
        tileGrid.append(tile);
      }
    }
  };
  renderTiles();
  if (typeof ResizeObserver === "function") {
    const resizeObserver = new ResizeObserver(() => {
      if (!viewport.isConnected) {
        resizeObserver.disconnect();
        return;
      }
      renderTiles();
    });
    resizeObserver.observe(viewport);
  }
}

function createGoogleMapsLink(query, label) {
  const link = document.createElement("a");
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({ api: "1", query });
  link.href = url.toString();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function createGoogleMapsLocationUrl(latitude, longitude) {
  const url = new URL("https://www.google.com/maps/search/");
  url.search = new URLSearchParams({
    api: "1",
    query: `${latitude},${longitude}`
  });
  return url.toString();
}

function createGoogleMapsLocationFallback() {
  const link = document.createElement("a");
  link.href = createGoogleMapsLocationFallbackUrl();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open Google Maps and use its location button";
  return link;
}

function createGoogleMapsLocationFallbackUrl() {
  const url = new URL("https://www.google.com/maps/");
  url.search = new URLSearchParams({ api: "1", map_action: "map" });
  return url.toString();
}

function createMapCard() {
  const existing = document.querySelector(".map-overlay .map-panel");
  if (existing) {
    const controls = {
      form: existing.querySelector(".map-search-form"),
      input: existing.querySelector(".map-search-form input"),
      searchButton: existing.querySelector(".map-search-form button[type='submit']"),
      locationButton: existing.querySelector(".map-search-form button[type='button']"),
      status: existing.querySelector(".map-status"),
      frame: existing.querySelector(".map-frame-container"),
      expandButton: existing.querySelector(".map-expand-button")
    };
    controls.input?.focus();
    return controls;
  }

  const overlay = document.createElement("div");
  overlay.className = "map-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Tactical map");

  const card = document.createElement("section");
  card.className = "info-panel map-panel";
  card.tabIndex = 0;
  card.dataset.mapCard = "true";
  card.addEventListener("click", (event) => event.stopPropagation());

  const panelLabel = document.createElement("div");
  panelLabel.className = "panel-label";
  panelLabel.innerHTML = '<span>MAP SIGHTLINES</span><span class="panel-index">04</span>';

  const form = document.createElement("form");
  form.className = "map-search-form";

  const input = document.createElement("input");
  input.type = "search";
  input.maxLength = 120;
  input.placeholder = "Search a city, address, or place";
  input.setAttribute("aria-label", "Search for a place on the map");

  const searchButton = document.createElement("button");
  searchButton.type = "submit";
  searchButton.textContent = "Search";

  const locationButton = document.createElement("button");
  locationButton.type = "button";
  locationButton.textContent = "Use my location";

  const status = document.createElement("p");
  status.className = "map-status";
  status.setAttribute("aria-live", "polite");

  const frame = document.createElement("div");
  frame.className = "map-frame-container";

  const expandButton = document.createElement("button");
  expandButton.type = "button";
  expandButton.className = "map-expand-button";
  expandButton.textContent = "Close map";
  expandButton.setAttribute("aria-label", "Close map");

  const closeMap = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    document.getElementById("map-button")?.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") closeMap();
  };
  expandButton.addEventListener("click", closeMap);
  overlay.addEventListener("click", closeMap);
  document.addEventListener("keydown", onKeyDown);

  form.append(input, searchButton, locationButton);
  card.append(panelLabel, form, status, frame, expandButton);
  overlay.append(card);
  document.body.append(overlay);
  requestAnimationFrame(() => {
    input.focus();
  });
  return { form, input, searchButton, locationButton, status, frame, expandButton };
}

async function searchMapPlace(controls) {
  const query = controls.input.value.trim();
  if (!query) {
    controls.status.textContent = "Enter a place to search for.";
    return;
  }
  const mapsTab = window.open("about:blank", "_blank");
  if (mapsTab) {
    mapsTab.opener = null;
    mapsTab.blur();
  }
  controls.searchButton.disabled = true;
  controls.locationButton.disabled = true;
  controls.frame.replaceChildren();
  controls.status.textContent = `Searching for “${query}”…`;
  try {
    const searchUrl = new URL("/api/map/search", window.location.origin);
    searchUrl.searchParams.set("q", query);
    const response = await fetch(searchUrl);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Place search failed.");
    }

    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Place search returned invalid coordinates.");
    }

    const name = typeof data.name === "string" && data.name.trim() ? data.name : query;
    renderMap(controls.frame, latitude, longitude, name, controls.status);
    controls.status.textContent = `Showing ${name}. Google Maps is opening in the background, and the HUD map remains active.`;
    if (mapsTab && !mapsTab.closed) {
      mapsTab.location.replace(createGoogleMapsLocationUrl(latitude, longitude));
      setTimeout(() => {
        if (!mapsTab.closed) mapsTab.blur();
      }, 150);
    }
  } catch (error) {
    if (mapsTab && !mapsTab.closed) mapsTab.close();
    controls.status.textContent = error.message || "Place search is unavailable right now. Please try again shortly.";
    controls.frame.replaceChildren(createGoogleMapsLink(query, `Open “${query}” in Google Maps`));
  } finally {
    controls.searchButton.disabled = false;
    controls.locationButton.disabled = false;
  }
}

async function showMap() {
  const controls = createMapCard();
  controls.form.addEventListener("submit", (event) => {
    event.preventDefault();
    runTool(() => searchMapPlace(controls));
  });
  controls.locationButton.addEventListener("click", () => {
    const mapsTab = window.open(createGoogleMapsLocationFallbackUrl(), "_blank");
    if (mapsTab) {
      mapsTab.opener = null;
      mapsTab.blur();
    }
    runTool(async () => {
      controls.locationButton.disabled = true;
      controls.status.textContent = "Google Maps is opening while JARVIS checks your approximate location…";
      try {
        const position = await getPosition();
        const latitude = Number(position.coords.latitude.toFixed(2));
        const longitude = Number(position.coords.longitude.toFixed(2));
        renderMap(controls.frame, latitude, longitude, "your approximate location", controls.status);
        controls.status.textContent = "Your approximate location is ready. Coordinates are rounded to about 1 km. The map tab is opening in the background.";
        if (mapsTab && !mapsTab.closed) {
          mapsTab.location.replace(createGoogleMapsLocationUrl(latitude, longitude));
          setTimeout(() => {
            if (!mapsTab.closed) mapsTab.blur();
          }, 150);
        }
      } catch (error) {
        const reason = error.code === 1
          ? "Location permission was denied. Allow location for this site in your browser settings, then try again."
          : error.code === 2
            ? "Your device or browser could not determine your location. Check that device location services are enabled."
            : error.code === 3
              ? "The location request timed out. Check your connection or device location settings, then try again."
              : error.message || "Your location could not be read.";
        controls.status.textContent = `${reason} Google Maps is open; use its location button to find yourself.`;
        controls.frame.replaceChildren(createGoogleMapsLocationFallback());
      } finally {
        controls.locationButton.disabled = false;
      }
    });
  });
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
    if (voiceOnlyMode && /^(?:(?:please\s+)?(?:exit|leave|close|quit)(?:\s+the)?\s+(?:full[\s-]?screen\s+)?(?:voice|assistant)?\s*mode|go back|return to dashboard|stop listening|mute (?:yourself|assistant))[?.!]*$/i.test(transcript)) {
      exitVoiceOnlyMode();
      return;
    }
    if (/^(?:repeat(?: that| your last response)?|say that again)[?.!]*$/i.test(transcript)) {
      const replies = chat.querySelectorAll(".message-assistant:not(.tool-message) .message-body");
      const lastReply = replies[replies.length - 1]?.textContent;
      if (lastReply) speak(lastReply);
      else speak("There is no previous response to repeat.");
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
  stopMicrophoneReactivity();
  document.getElementById("mic-reactive-toggle").checked = false;
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

function formatStopwatch(milliseconds) {
  const tenths = Math.floor(milliseconds / 100);
  const seconds = Math.floor(tenths / 10);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainderSeconds = seconds % 60;
  const remainderTenths = tenths % 10;
  if (hours) {
    return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}.${remainderTenths}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainderSeconds).padStart(2, "0")}.${remainderTenths}`;
}

function getStopwatchElapsed() {
  return stopwatchElapsed + (stopwatchStartedAt ? Date.now() - stopwatchStartedAt : 0);
}

function renderStopwatch() {
  document.getElementById("stopwatch-display").textContent = formatStopwatch(getStopwatchElapsed());
  document.getElementById("stopwatch-toggle").textContent = stopwatchStartedAt ? "Stop" : "Start";
}

function toggleStopwatch() {
  if (stopwatchStartedAt) {
    stopwatchElapsed += Date.now() - stopwatchStartedAt;
    stopwatchStartedAt = 0;
    clearInterval(stopwatchInterval);
  } else {
    stopwatchStartedAt = Date.now();
    stopwatchInterval = setInterval(renderStopwatch, 100);
  }
  renderStopwatch();
}

function resetStopwatch() {
  stopwatchStartedAt = 0;
  stopwatchElapsed = 0;
  clearInterval(stopwatchInterval);
  renderStopwatch();
}

function getStorageUsage() {
  try {
    let bytes = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key !== null) bytes += (key.length + localStorage.getItem(key).length) * 2;
    }
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } catch {
    return "Unavailable";
  }
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateLocalDiagnostics() {
  document.getElementById("session-uptime").textContent = formatDuration(Date.now() - sessionStartedAt);
  document.getElementById("command-count").textContent = String(sessionCommandCount);
  document.getElementById("storage-usage").textContent = getStorageUsage();
}

function getDiagnosticsReport() {
  const speechOutput = "speechSynthesis" in window ? "available" : "unavailable";
  const speechInput = speechSupported ? "available" : "unsupported in this browser";
  const connection = navigator.onLine ? "online" : "offline";
  const cpu = cpuUsage.textContent;
  const gpuCount = gpuMetrics.querySelectorAll(".resource-metric").length;
  const gpu = gpuCount ? `${gpuCount} device${gpuCount === 1 ? "" : "s"} reporting` : "not detected";
  return `Local diagnostics: connection ${connection}; speech input ${speechInput}; speech output ${speechOutput}; CPU ${cpu}; GPU ${gpu}; browser storage ${getStorageUsage()}; ${sessionCommandCount} command${sessionCommandCount === 1 ? "" : "s"} this session; uptime ${formatDuration(Date.now() - sessionStartedAt)}.`;
}

function renderCommandAliases() {
  const list = document.getElementById("alias-list");
  list.replaceChildren();
  commandAliases.forEach((alias, index) => {
    const row = document.createElement("div");
    row.className = "alias-row";
    const label = document.createElement("span");
    label.textContent = `${alias.phrase} → ${alias.command}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "alias-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove alias ${alias.phrase}`);
    remove.addEventListener("click", () => {
      const previousAliases = commandAliases.slice();
      commandAliases.splice(index, 1);
      if (saveCommandAliases()) {
        renderCommandAliases();
      } else {
        commandAliases = previousAliases;
      }
    });
    row.append(label, remove);
    list.appendChild(row);
  });
}

function getAliasedCommand(text) {
  const normalized = text.trim().replace(/[?.!]+$/, "").toLocaleLowerCase();
  return commandAliases.find((alias) =>
    alias.phrase.toLocaleLowerCase() === normalized
  )?.command || text;
}

async function sendMessage(message) {
  const text = message.trim();
  if (!text) return;

  sessionCommandCount += 1;
  updateLocalDiagnostics();
  addMessage(text, "user");
  input.value = "";
  setActive(true);

  const commandText = getAliasedCommand(text);
  const isOpenCommand = /^open\b/i.test(commandText);
  const target = getOpenTarget(commandText);
  if (isOpenCommand && target) {
    window.open(target, "_blank", "noopener,noreferrer");
    const destination = target.includes("/search?")
      ? `a web search for ${commandText.replace(/^open\s+(?:the\s+)?/i, "").replace(/[?.!]+$/, "")}`
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

  const localClockReply = getLocalClockReply(commandText);
  if (localClockReply) {
    addMessage(localClockReply, "assistant");
    speak(localClockReply);
    setActive(false);
    return;
  }

  const normalized = commandText.toLowerCase();
  if (/^(?:start|begin|run) (?:the )?stopwatch$/.test(normalized)) {
    if (!stopwatchStartedAt) toggleStopwatch();
    const reply = "Stopwatch started.";
    addMessage(reply, "assistant");
    speak(reply);
    setActive(false);
    return;
  }
  if (/^(?:stop|pause) (?:the )?stopwatch$/.test(normalized)) {
    if (stopwatchStartedAt) toggleStopwatch();
    const reply = `Stopwatch stopped at ${formatStopwatch(getStopwatchElapsed())}.`;
    addMessage(reply, "assistant");
    speak(reply);
    setActive(false);
    return;
  }
  if (/^(?:reset|clear) (?:the )?stopwatch$/.test(normalized)) {
    resetStopwatch();
    const reply = "Stopwatch reset.";
    addMessage(reply, "assistant");
    speak(reply);
    setActive(false);
    return;
  }
  if (/^(?:show )?(?:system )?status$|^(?:run )?diagnostics$/.test(normalized)) {
    const reply = getDiagnosticsReport();
    addMessage(reply, "assistant");
    speak(reply);
    setActive(false);
    return;
  }
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
  const timerRequest = parseTimerRequest(commandText);
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

  const localReply = runLocalCommand(commandText);
  if (localReply) {
    addMessage(localReply, "assistant");
    speak(localReply);
    setActive(false);
    return;
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: commandText,
        history: getConversationHistory(),
        personality: localPreferences.personality
      })
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

function setResourceBar(bar, usagePercent) {
  bar.setAttribute("aria-valuenow", String(usagePercent));
  bar.firstElementChild.style.width = `${usagePercent}%`;
}

function renderGpuMetrics(gpu) {
  gpuMetrics.replaceChildren();
  if (!gpu.available || !gpu.devices.length) {
    const unavailable = document.createElement("p");
    unavailable.className = "resource-unavailable";
    unavailable.textContent = gpu.reason || "GPU utilization is unavailable on this device.";
    gpuMetrics.appendChild(unavailable);
    return;
  }

  gpu.devices.forEach((device, index) => {
    const metric = document.createElement("div");
    metric.className = "resource-metric";

    const heading = document.createElement("div");
    heading.className = "resource-heading";
    const label = document.createElement("span");
    label.textContent = `GPU${gpu.devices.length > 1 ? ` ${index + 1}` : ""} `;
    const name = document.createElement("small");
    name.textContent = device.name;
    label.appendChild(name);

    const value = document.createElement("strong");
    value.textContent = `${device.usagePercent}%`;
    heading.append(label, value);

    const bar = document.createElement("div");
    bar.className = "resource-track";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", `${device.name} GPU utilization`);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    const fill = document.createElement("span");
    bar.appendChild(fill);
    setResourceBar(bar, device.usagePercent);

    metric.append(heading, bar);
    gpuMetrics.appendChild(metric);
  });
}

async function updateSystemMetrics() {
  if (isUpdatingSystemMetrics) return;
  isUpdatingSystemMetrics = true;
  try {
    const response = await fetch("/api/system", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `System monitor request failed (HTTP ${response.status}).`);
    }
    if (!data.cpu || !data.gpu || !Array.isArray(data.gpu.devices)) {
      throw new Error("The local system monitor returned invalid device metrics.");
    }

    cpuDevice.textContent = `${data.cpu.name} · ${data.cpu.coreCount} logical cores`;
    if (Number.isFinite(data.cpu.usagePercent)) {
      cpuUsage.textContent = `${data.cpu.usagePercent}%`;
      setResourceBar(cpuBar, data.cpu.usagePercent);
    } else {
      cpuUsage.textContent = "Sampling…";
      cpuBar.removeAttribute("aria-valuenow");
      cpuBar.firstElementChild.style.width = "0%";
    }
    renderGpuMetrics(data.gpu);
    resourceUpdated.textContent = `Updated ${new Date(data.sampledAt).toLocaleTimeString()}`;
  } catch (error) {
    resourceUpdated.textContent = `System metrics unavailable: ${error.message}`;
  } finally {
    isUpdatingSystemMetrics = false;
  }
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
document.getElementById("map-button").addEventListener("click", () => runTool(showMap));
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
const profileSelect = document.getElementById("profile-select");
const profileNameInput = document.getElementById("profile-name");
window.addEventListener("storage", syncProfilesAcrossTabs);
profileSelect.addEventListener("change", () => setActiveProfile(profileSelect.value));
document.getElementById("profile-save").addEventListener("click", () => {
  const name = profileNameInput.value.trim().slice(0, 80);
  const duplicate = profiles.find((profile) =>
    profile.id !== activeProfileId &&
    name &&
    profile.profile.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  );
  if (duplicate) {
    toolStatus.textContent = `A profile named ${name} already exists. Switch to it or choose another name.`;
    return;
  }
  localData.profile.name = name;
  const saved = saveLocalData();
  renderProfiles();
  toolStatus.textContent = saved
    ? name ? `Saved your local profile name as ${name}.` : "Cleared your local profile name."
    : "The profile change is only available until this page closes because browser storage is unavailable.";
});
document.getElementById("profile-add").addEventListener("click", () => addProfile(profileNameInput.value));
profileNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") document.getElementById("profile-save").click();
});
voiceSelect.addEventListener("change", () => {
  if (!("speechSynthesis" in window)) {
    toolStatus.textContent = "Speech synthesis is not supported in this browser.";
    return;
  }
  const voice = window.speechSynthesis.getVoices().find((item) => item.name === voiceSelect.value);
  if (!voice) {
    toolStatus.textContent = "The selected browser voice is no longer available.";
    return;
  }
  localData.voiceName = voice.name;
  const saved = saveLocalData();
  toolStatus.textContent = `Using ${voice.name} (${voice.lang}) for ${localData.profile.name || "this profile"}${saved ? "." : " for this session; browser storage is unavailable."}`;
});
const speechRate = document.getElementById("speech-rate");
const speechPitch = document.getElementById("speech-pitch");
const speechMuteButton = document.getElementById("speech-mute-button");
const updateSpeechSettings = () => {
  speechRate.value = String(localPreferences.speechRate);
  speechPitch.value = String(localPreferences.speechPitch);
  document.getElementById("speech-rate-value").textContent = `${localPreferences.speechRate.toFixed(1)}×`;
  document.getElementById("speech-pitch-value").textContent = localPreferences.speechPitch.toFixed(1);
  speechMuteButton.textContent = localPreferences.speechMuted ? "Unmute speech" : "Mute speech";
  speechMuteButton.setAttribute("aria-pressed", String(localPreferences.speechMuted));
};
speechRate.addEventListener("input", () => {
  localPreferences.speechRate = Number(speechRate.value);
  updateSpeechSettings();
  saveLocalPreferences();
});
speechPitch.addEventListener("input", () => {
  localPreferences.speechPitch = Number(speechPitch.value);
  updateSpeechSettings();
  saveLocalPreferences();
});
speechMuteButton.addEventListener("click", () => {
  localPreferences.speechMuted = !localPreferences.speechMuted;
  if (localPreferences.speechMuted && "speechSynthesis" in window) {
    ++speechSequence;
    window.speechSynthesis.cancel();
    speechPending = false;
    isSpeaking = false;
    renderAssistantState();
  }
  updateSpeechSettings();
  saveLocalPreferences();
  scheduleVoiceListening();
  toolStatus.textContent = localPreferences.speechMuted
    ? "Speech output muted. Voice input and text replies still work."
    : "Speech output unmuted.";
});
document.getElementById("stopwatch-toggle").addEventListener("click", toggleStopwatch);
document.getElementById("stopwatch-reset").addEventListener("click", resetStopwatch);
document.getElementById("alias-add").addEventListener("click", () => {
  const phraseInput = document.getElementById("alias-name");
  const commandInput = document.getElementById("alias-command");
  const phrase = phraseInput.value.trim().replace(/[?.!]+$/, "");
  const command = commandInput.value.trim();
  if (!phrase || !command) {
    toolStatus.textContent = "Enter both an alias phrase and the command it should run.";
    return;
  }
  const previousAliases = commandAliases.slice();
  if (phrase.length > 60 || command.length > 120) {
    toolStatus.textContent = "Alias phrases must be 60 characters or less and commands 120 characters or less.";
    return;
  }
  const existingIndex = commandAliases.findIndex((alias) =>
    alias.phrase.toLocaleLowerCase() === phrase.toLocaleLowerCase()
  );
  if (existingIndex >= 0) commandAliases.splice(existingIndex, 1);
  if (commandAliases.length >= 30) {
    toolStatus.textContent = "You can save up to 30 command aliases.";
    return;
  }
  commandAliases.push({ phrase, command });
  if (!saveCommandAliases()) {
    commandAliases = previousAliases;
    return;
  }
  renderCommandAliases();
  phraseInput.value = "";
  commandInput.value = "";
  toolStatus.textContent = `Saved “${phrase}” as an alias for “${command}”.`;
});
document.getElementById("diagnostics-button").addEventListener("click", () => {
  sendMessage("Run diagnostics");
});
document.getElementById("theme-select").addEventListener("change", (event) => {
  localPreferences.theme = event.currentTarget.value;
  applyAppearancePreferences();
  if (saveLocalPreferences()) toolStatus.textContent = `Saved ${event.currentTarget.selectedOptions[0].textContent} theme in this browser.`;
});
document.getElementById("personality-select").addEventListener("change", (event) => {
  localPreferences.personality = event.currentTarget.value;
  if (saveLocalPreferences()) {
    toolStatus.textContent = `Saved ${event.currentTarget.selectedOptions[0].textContent} assistant response style in this browser.`;
  }
});
document.getElementById("mic-reactive-toggle").addEventListener("change", (event) => {
  if (event.currentTarget.checked) {
    startMicrophoneReactivity();
  } else {
    stopMicrophoneReactivity();
    toolStatus.textContent = "Microphone-reactive visuals are off. The microphone is no longer in use by the visualizer.";
  }
});
document.getElementById("voice-test-button").addEventListener("click", () => {
  if (localPreferences.speechMuted) {
    toolStatus.textContent = "Speech output is muted. Unmute speech to preview the selected voice.";
    return;
  }
  if (!("speechSynthesis" in window)) {
    toolStatus.textContent = "Speech synthesis is not supported in this browser.";
    return;
  }
  const voice = window.speechSynthesis.getVoices()
    .find((item) => item.name === localData.voiceName);
  if (!voice) {
    toolStatus.textContent = "The selected browser voice is unavailable.";
    return;
  }
  toolStatus.textContent = `Previewing ${voice.name} (${voice.lang}) for ${localData.profile.name || "this profile"}.`;
  speak("Good day. Systems are online. How may I assist you?");
});
document.addEventListener("keydown", (event) => {
  const editing = event.target instanceof HTMLElement &&
    (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
  if (event.key === "Escape") {
    const menu = document.querySelector(".rail-menu");
    if (menu.open) {
      menu.open = false;
      document.querySelector(".rail-menu-toggle").focus();
    }
    return;
  }
  if (editing || !event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key.toLocaleLowerCase() === "k" && !event.shiftKey) {
    event.preventDefault();
    input.focus();
  } else if (event.key.toLocaleLowerCase() === "v" && event.shiftKey) {
    event.preventDefault();
    voiceModeEnter.click();
  }
});
updateSpeechSettings();
applyAppearancePreferences();
updateNetworkStatus();
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
renderStopwatch();
renderCommandAliases();
updateLocalDiagnostics();
setInterval(updateLocalDiagnostics, 1000);
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
renderProfiles();
updateMemorySummary();
checkTimers();
setInterval(checkTimers, 1000);

voiceButton.addEventListener("click", () => startVoiceRecognition());

voiceStatus.textContent = speechSupported ? "VOICE INPUT AVAILABLE" : "VOICE INPUT NOT SUPPORTED";
restoreMessages();
updateClock();
setInterval(updateClock, 1000);
updateSystemMetrics();
setInterval(updateSystemMetrics, 3000);

window.addEventListener("load", () => {
  if (!("serviceWorker" in navigator)) {
    toolStatus.textContent = "Offline app installation is not supported by this browser.";
    return;
  }
  navigator.serviceWorker.register("/service-worker.js").catch((error) => {
    toolStatus.textContent = `Offline app setup failed: ${error.message}`;
  });
});
