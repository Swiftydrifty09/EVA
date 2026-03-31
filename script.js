const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");

sendBtn.onclick = () => sendMessage();

inputEl.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function appendMessage(sender, text) {
  const div = document.createElement("div");
  div.textContent = `${sender}: ${text}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendMessage(userMessageOverride = null) {
  const message = userMessageOverride || inputEl.value.trim();
  if (!message) return;

  appendMessage("You", message);
  inputEl.value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();
    appendMessage("JARVIS", data.reply);

    speak(data.reply);

  } catch (err) {
    appendMessage("JARVIS", "Error connecting to server.");
  }
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utterance);
}

// 🎤 Voice Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";

  micBtn.onclick = () => recognition.start();

  recognition.onresult = (event) => {
    let transcript = event.results[0][0].transcript.toLowerCase();

    if (transcript.includes("jarvis")) {
      transcript = transcript.replace("jarvis", "").trim();
    }

    if (transcript) {
      sendMessage(transcript);
    }
  };
}