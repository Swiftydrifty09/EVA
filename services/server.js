import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd())));

const PORT = process.env.PORT || 3000;

app.post("/api/chat", async (req, res) => {
    const userMessage = req.body.message;

    // If API key is not set or placeholder, skip API call
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_api_key_here') {
        return res.json({ reply: "API key not configured. Using local responses." });
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are JARVIS: a highly intelligent, calm, and efficient AI assistant." },
                    { role: "user", content: userMessage }
                ]
            })
        });

        const data = await response.json();
        const reply = data.choices[0].message.content;

        res.json({ reply });

    } catch (error) {
        res.status(500).json({ error: "AI request failed" });
    }
});

app.listen(PORT, () => {
    console.log(`JARVIS running on port ${PORT}`);
});