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

    const memory = getMemory(sessionId);

    const messages = [
      {
        role: "system",
        content: "You are JARVIS. Answer clearly and directly."
      },
      ...memory,
      {
        role: "user",
        content: message
      }
    ];

    // store user message BEFORE response
    addToMemory(sessionId, { role: "user", content: message });

    const fullResponse = await getAIResponse(messages, res);

    // store AI response AFTER
    addToMemory(sessionId, { role: "assistant", content: fullResponse });

  } catch (err) {
    console.error("ROUTE ERROR:", err);
    res.status(500).end();
  }
});