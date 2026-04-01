const recognition = new (window.SpeechRecognition ||
  window.webkitSpeechRecognition)();

recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = async (event) => {
  const transcript = event.results[0][0].transcript;

  sendToBackend(transcript);
};

recognition.start();