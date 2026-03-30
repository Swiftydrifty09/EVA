class Jarvis {
  constructor() {
    this.active = false;
    this.memory = JSON.parse(localStorage.getItem("jarvisMemory") || "null") || { conversations: [] };
  }

  activate() {
    this.active = true;
  }

  processCommand(input) {
    if (!this.active) {
      return "System is offline. Activate JARVIS first.";
    }

    const message = input.toLowerCase().trim();

    if (!message) {
      return "Please type something for JARVIS to process.";
    }

    if (message.includes("hello") || message.includes("hi")) {
      return "Hello, sir. How can I assist you today?";
    }

    if (message.includes("time")) {
      return `Current time is ${new Date().toLocaleTimeString()}.`;
    }

    if (message.includes("date")) {
      return `Today's date is ${new Date().toLocaleDateString()}.`;
    }

    if (message.includes("weather")) {
      return "I can't retrieve live weather in offline mode yet, but expect clear skies soon.";
    }

    if (message.includes("open google")) {
      window.open("https://www.google.com", "_blank");
      return "Opening Google for you.";
    }

    if (message.includes("joke")) {
      return "Why did the programmer quit his job? Because he didn't get arrays (a raise)!";
    }

    if (message.includes("help")) {
      return "Try: hello, time, date, weather, open google, joke, clear chat.";
    }

    if (message === "clear chat") {
      clearChat();
      return "Chat cleared.";
    }

    return "I didn\'t understand that command, but I'm learning. Please try another phrase.";
  }

  remember(user, assistant) {
    this.memory.conversations.push({ timestamp: Date.now(), user, assistant });
    if (this.memory.conversations.length > 100) {
      this.memory.conversations.shift();
    }
    localStorage.setItem("jarvisMemory", JSON.stringify(this.memory));
  }
}

const jarvis = new Jarvis();
jarvis.activate();

const statusEl = document.getElementById("status");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const voiceBtn = document.getElementById("voiceBtn");
const stopVoiceBtn = document.getElementById("stopVoiceBtn");
const sphereEl = document.getElementById("sphere");

statusEl.textContent = "Status: JARVIS ONLINE";

function appendMessage(sender, message) {
  const item = document.createElement("div");
  item.className = sender === "user" ? "message user" : "message jarvis";
  item.textContent = `${sender === "user" ? "You" : "JARVIS"}: ${message}`;
  chatEl.appendChild(item);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendMessage() {
  const userMessage = inputEl ? inputEl.value.trim() : currentTranscript;
  if (!userMessage) return;

  appendMessage("user", userMessage);
  if (inputEl) inputEl.value = "";

  try {
    const response = await getJarvisResponse(userMessage);
    appendMessage("jarvis", response);
    jarvis.remember(userMessage, response);
    speak(response);
  } catch (error) {
    appendMessage("jarvis", "Error: unable to get response. Check your network or server.");
  }
}

async function getJarvisResponse(message) {
  let reply = jarvis.processCommand(message);

  try {
    const apiResponse = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!apiResponse.ok) {
      throw new Error("API response not OK");
    }

    const data = await apiResponse.json();
    if (data && data.reply) {
      reply = data.reply;
    }
  } catch (err) {
    console.warn('API call failed, using local Jarvis:', err);
  }

  return reply;
}

function clearChat() {
  chatEl.innerHTML = "";
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

let currentRecognition = null;
let currentTranscript = "";

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendMessage("jarvis", "Speech recognition is not supported in this browser.");
    return;
  }

  currentRecognition = new SpeechRecognition();
  currentRecognition.lang = 'en-US';
  currentRecognition.interimResults = false;
  currentRecognition.maxAlternatives = 1;
  currentRecognition.continuous = true;

  currentRecognition.onstart = () => {
    showVoiceMode();
  };

  currentRecognition.onresult = (event) => {
    currentTranscript = event.results[event.results.length - 1][0].transcript.toLowerCase();
    if (currentTranscript.includes("jarvis")) {
      const command = currentTranscript.replace("jarvis", "").trim();
      if (command) {
        currentTranscript = command;
        sendMessage();
      } else {
        appendMessage("jarvis", "Yes, sir? How can I assist you?");
      }
    } else {
      sendMessage();
    }
  };

  currentRecognition.onerror = (event) => {
    appendMessage("jarvis", `Speech recognition error: ${event.error}`);
    stopVoiceMode();
  };

  currentRecognition.onend = () => {
    stopVoiceMode();
  };

  currentRecognition.start();
}

function showVoiceMode() {
  sphereEl.style.display = 'block';
  createSphereDots();
  voiceBtn.style.display = 'none';
  stopVoiceBtn.style.display = 'inline-block';
  statusEl.textContent = "Status: LISTENING";
}

function stopVoiceMode() {
  if (currentRecognition) {
    currentRecognition.stop();
    currentRecognition = null;
  }
  sphereEl.style.display = 'none';
  removeSphereDots();
  voiceBtn.style.display = 'inline-block';
  stopVoiceBtn.style.display = 'none';
  statusEl.textContent = "Status: JARVIS ONLINE";
}

function createSphereDots() {
  for (let i = 0; i < 20; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.animationDelay = `${i * 0.15}s`;
    sphereEl.appendChild(dot);
  }
}

function removeSphereDots() {
  sphereEl.innerHTML = '';
}

stopVoiceBtn.addEventListener("click", stopVoiceMode);
voiceBtn.addEventListener("click", startVoice);

if (sendBtn) {
  sendBtn.addEventListener("click", sendMessage);
}
if (inputEl) {
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });
}
