const express = require("express");
const router = express.Router();

const { getMemory, addToMemory } = require("../../services/memory");

router.post("/", async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "default";

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const history = getMemory(sessionId);
    addToMemory(sessionId, { role: "user", content: message });

    const reply = "This route is kept for compatibility. The live app uses the local browser assistant at /api/chat.";
    addToMemory(sessionId, { role: "assistant", content: reply });

    res.json({ reply, history });
  } catch (error) {
    console.error("Chat route compatibility error:", error);
    res.status(500).json({ error: "Chat route failed." });
  }
});

module.exports = router;