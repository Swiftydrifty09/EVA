import express from "express";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/", (req, res) => {
  res.sendFile(path.resolve("public/index.html"));
});
// API route
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "No message provided." });
    }

    return res.json({
      reply: `You said: ${message}`
    });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ reply: "Internal server error." });
  }
});

// Port
const PORT = process.env.PORT || 3000;

// Start server
app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});