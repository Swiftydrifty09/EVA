import express from "express";
import { getAIResponse } from "./services/ai.js";
import { getMemory, addToMemory } from "./services/memory.js";
import { SYSTEM_PROMPT } from "./config/prompt.js";
import { getCurrentTime, calculate, searchWeb } from "./services/tools.js";

const app = express();
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  addToMemory(sessionId, "user", message);

  const memory = getMemory(sessionId);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...memory
  ];

  // Send to AI
  let reply = await getAIResponse(messages);

  // 🔧 Simple tool detection layer (can be improved later)
  if (message.includes("time")) {
    reply = await getCurrentTime();
  }

  if (message.startsWith("calculate")) {
    const expression = message.replace("calculate", "").trim();
    reply = calculate(expression);
  }

  if (message.startsWith("search")) {
    const query = message.replace("search", "").trim();
    reply = await searchWeb(query);
  }

  addToMemory(sessionId, "assistant", reply);

  res.json({ reply });
});

app.listen(3000, () => {
  console.log("JARVIS running on port 3000");
});