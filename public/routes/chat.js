const express = require("express");
const router = express.Router();

const { getMemory, addToMemory } = require("../../services/memory");
const { getAIResponse } = require("../../services/ai");

router.post("/", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const memory = getMemory(sessionId) || [];

    const messages = [
      {
        role: "system",
        content: "You are JARVIS. Respond clearly and directly.",
      },
      ...memory,
      {
        role: "user",
        content: message,
      },
    ];

    // Capture assistant response (IMPORTANT)
    let assistantResponse = "";

    await getAIResponse(messages, res, (chunk) => {
      assistantResponse += chunk;
    });

    // Store BOTH sides
    addToMemory(sessionId, { role: "user", content: message });
    addToMemory(sessionId, { role: "assistant", content: assistantResponse });

  } catch (err) {
    console.error(err);
    res.end("\n[ERROR]");
  }
});

module.exports = router;