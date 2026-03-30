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
  const userMessage = inputEl.value.trim();
  if (!userMessage) return;

  appendMessage("user", userMessage);
  inputEl.value = "";

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

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendMessage("jarvis", "Speech recognition is not supported in this browser.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    inputEl.value = transcript;
    sendMessage();
  };

  recognition.onerror = (event) => {
    appendMessage("jarvis", `Speech recognition error: ${event.error}`);
  };

  recognition.start();
}

sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});
voiceBtn.addEventListener("click", startVoice);
