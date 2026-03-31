import express from "express";
import path from "path";

const app = express();
app.use(express.json());

// Serve frontend
app.use(express.static(path.resolve("public")));

// API route
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "No message provided." });
  }

  // Placeholder logic (replace with AI later)
  const reply = `You said: ${message}`;

  res.json({ reply });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`JARVIS running on http://localhost:${PORT}`);
});