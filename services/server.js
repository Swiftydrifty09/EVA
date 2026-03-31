import express from "express";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.static(path.resolve("public")));

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "No message provided." });
  }

  return res.json({
    reply: `You said: ${message}`
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});